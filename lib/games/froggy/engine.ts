// Froggy engine — framework-free, new game (no source port).

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { PAD_COLS, drawFrame, type FroggySkin } from "./draw";
import { createFroggySound } from "./sound";
import {
  CELL,
  H,
  LANES,
  W,
  diveState,
  entityXs,
  modulusOf,
  speedMult,
  type Lane,
} from "./lanes";

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;
const HOP_MS = 90;
const DEATH_MS = 800;
const TIME_LIMIT = 30; // seconds per frog
const START_LIVES = 3;
const START_ROW = 11;
const START_X = 320;
const FROG_HALF = 14; // 28x28 hitbox
const MAX_SCORE = 10_000_000;

const PTS_ROW = 10;
const PTS_PAD = 50;
const PTS_SECOND = 10;
const PTS_LEVEL = 1000;
const PTS_FLY = 200;

const FLY_EVERY_MS = 10000;
const FLY_VISIBLE_MS = 5000;
const FLY_FROM_LEVEL = 2;
const SNAKE_FROM_LEVEL = 3;
const SNAKE_SPEED = 80;
const SNAKE_W = 2 * CELL;
const SNAKE_HIT_W = 72;
const SNAKE_DELAY_MS = 1500;
const SNAKE_ROW = 5;

type Dir = "up" | "down" | "left" | "right";
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
const GAME_KEYS = [...Object.keys(KEY_DIRS), "Space"];
const IGNORED_TARGETS = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"];

const rowY = (row: number) => row * CELL + CELL / 2;
const isRiver = (row: number) => row >= 1 && row <= 4;
const isRoad = (row: number) => row >= 6 && row <= 10;
const laneOf = (row: number): Lane | undefined =>
  LANES.find((l) => l.row === row);

export type { FroggySkin };

export interface FroggyEngine extends GameEngine {
  setMuted(muted: boolean): void;
  setAppearance(skin: FroggySkin): void; // redraws now
}

type DeathKind = "splash" | "squash" | "timeout";

export function createFroggyGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): FroggyEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Canvas can't read CSS vars directly; resolve the platform pixel font once.
  const fontFamily =
    getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";

  let phases: number[] = LANES.map(() => 0);
  let frogX = START_X;
  let frogRow = START_ROW;
  let hopT = HOP_MS; // >= HOP_MS means not hopping
  let hopFromX = START_X;
  let hopFromY = rowY(START_ROW);
  let bestRow = START_ROW; // highest row reached in this attempt
  let timeLeft = TIME_LIMIT;
  let dyingT = -1; // >= 0 while dying (ms elapsed)
  let pads: boolean[] = PAD_COLS.map(() => false);
  const sound = createFroggySound();
  let skin: FroggySkin = "neon";
  let warnSeen: boolean[] = [];
  let playMs = 0; // playing time, drives the turtle dive cycle
  let flyClock = 0;
  let fly: { pad: number; ms: number } | null = null;
  let snake = { x: -SNAKE_W, dir: 1 as 1 | -1, delay: SNAKE_DELAY_MS };
  let score = 0;
  let lives = START_LIVES;
  let roundsCleared = 0;
  let ready = true;
  let paused = false;
  let gameOver = false;
  let accum = 0;
  let lastTime = 0;
  let rafId = 0;

  // Last values sent to callbacks, so they fire only on change
  let sentScore = -1;
  let sentLives = -1;
  let sentLevel = -1;

  const level = () => 1 + roundsCleared;

  function syncCallbacks() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (level() !== sentLevel) callbacks.onLevel((sentLevel = level()));
  }

  const addScore = (n: number) => {
    score = Math.min(MAX_SCORE, Math.max(0, score + n));
  };

  // ── Rules ─────────────────────────────────────────────────────────────────
  function endGame() {
    if (gameOver) return;
    gameOver = true;
    sound.play("gameOver");
    syncCallbacks();
    callbacks.onGameOver(score);
  }

  function respawn() {
    frogX = START_X;
    frogRow = START_ROW;
    hopT = HOP_MS;
    bestRow = START_ROW;
    timeLeft = TIME_LIMIT;
    dyingT = -1;
  }

  function die(kind: DeathKind) {
    if (dyingT >= 0) return;
    sound.play(kind);
    dyingT = 0;
    hopT = HOP_MS;
  }

  function finishDeath() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      dyingT = -1;
      endGame();
      return;
    }
    respawn();
  }

  function fillPad(i: number) {
    pads[i] = true;
    addScore(PTS_PAD + PTS_SECOND * Math.floor(timeLeft));
    if (fly && fly.pad === i) addScore(PTS_FLY);
    fly = null;
    sound.play(pads.every(Boolean) ? "levelClear" : "pad");
    if (pads.every(Boolean)) {
      addScore(PTS_LEVEL);
      roundsCleared++;
      pads = PAD_COLS.map(() => false);
      flyClock = 0;
    }
    respawn();
  }

  function laneIndex(row: number) {
    return LANES.findIndex((l) => l.row === row);
  }

  /** True if the frog center is on a log of its river row. */
  function onLog(): boolean {
    const lane = laneOf(frogRow);
    if (!lane || lane.kind !== "log") return false;
    const w = lane.w * CELL;
    return entityXs(lane, phases[laneIndex(frogRow)]).some(
      (x, idx) =>
        frogX >= x &&
        frogX <= x + w &&
        !(lane.dive && diveState(idx, playMs) === "under"),
    );
  }

  function hitsSnake(): boolean {
    if (frogRow !== SNAKE_ROW || level() < SNAKE_FROM_LEVEL) return false;
    if (snake.delay > 0) return false;
    const left = snake.x + (SNAKE_W - SNAKE_HIT_W) / 2;
    return frogX + FROG_HALF > left && frogX - FROG_HALF < left + SNAKE_HIT_W;
  }

  function updateFly(dt: number) {
    if (level() < FLY_FROM_LEVEL) return;
    if (fly) {
      fly.ms -= dt;
      if (fly.ms <= 0) fly = null;
      return;
    }
    flyClock += dt;
    if (flyClock >= FLY_EVERY_MS) {
      const empty = PAD_COLS.map((_, i) => i).filter((i) => !pads[i]);
      if (empty.length) {
        fly = {
          pad: empty[Math.floor(Math.random() * empty.length)],
          ms: FLY_VISIBLE_MS,
        };
        sound.play("fly");
      }
      flyClock = 0;
    }
  }

  function updateSnake(dt: number, sec: number, mult: number) {
    if (level() < SNAKE_FROM_LEVEL) return;
    if (snake.delay > 0) {
      snake.delay = Math.max(0, snake.delay - dt);
      if (snake.delay > 0) return;
    }
    // Re-entry is skipped while the frog stands near the entry point.
    const entering = snake.dir === 1 ? snake.x <= -SNAKE_W : snake.x >= W;
    if (entering && frogRow === SNAKE_ROW) {
      const edgeX = snake.dir === 1 ? 0 : W;
      if (Math.abs(frogX - edgeX) < 80 + SNAKE_W) return;
    }
    snake.x += snake.dir * SNAKE_SPEED * mult * sec;
    if (snake.dir === 1 && snake.x > W) {
      snake = { x: W, dir: -1, delay: SNAKE_DELAY_MS };
    } else if (snake.dir === -1 && snake.x < -SNAKE_W) {
      snake = { x: -SNAKE_W, dir: 1, delay: SNAKE_DELAY_MS };
    }
  }

  function hitsVehicle(): boolean {
    const lane = laneOf(frogRow);
    if (!lane || !isRoad(frogRow)) return false;
    const w = lane.w * CELL;
    return entityXs(lane, phases[laneIndex(frogRow)]).some(
      (x) => frogX + FROG_HALF > x + 2 && frogX - FROG_HALF < x + w - 2,
    );
  }

  function land() {
    if (frogRow === 0) {
      const i = PAD_COLS.findIndex(
        (c) => frogX >= c * CELL && frogX <= (c + 1) * CELL,
      );
      if (i < 0 || pads[i]) die("splash");
      else fillPad(i);
      return;
    }
    if (isRiver(frogRow)) {
      if (!onLog()) die("splash");
      return;
    }
    frogX = Math.min(620, Math.max(20, frogX));
    if ((isRoad(frogRow) && hitsVehicle()) || hitsSnake()) die("squash");
  }

  function hop(dir: Dir) {
    if (hopT < HOP_MS || dyingT >= 0 || ready || paused || gameOver) return;
    let nx = frogX;
    let nr = frogRow;
    if (dir === "up") nr--;
    else if (dir === "down") nr++;
    else if (dir === "left") nx -= CELL;
    else nx += CELL;
    if (nr < 0 || nr > START_ROW) return;
    if (!isRiver(frogRow) && nx !== frogX) nx = Math.min(620, Math.max(20, nx));
    hopFromX = frogX;
    hopFromY = rowY(frogRow);
    hopT = 0;
    sound.play("hop");
    frogX = nx;
    frogRow = nr;
    if (nr < bestRow) {
      bestRow = nr;
      addScore(PTS_ROW);
    }
    land();
  }

  function update(dt: number) {
    if (ready || paused || gameOver) return;
    const mult = speedMult(level());
    const sec = dt / 1000;
    playMs += dt;

    LANES.forEach((lane, i) => {
      const m = modulusOf(lane);
      phases[i] = (phases[i] + lane.dir * lane.speed * mult * sec) % m;
    });

    if (dyingT >= 0) {
      dyingT += dt;
      if (dyingT >= DEATH_MS) finishDeath();
      return;
    }

    const turtles = laneOf(4);
    if (turtles) {
      const n = entityXs(turtles, phases[laneIndex(4)]).length;
      for (let i = 0; i < n; i++) {
        const warn = diveState(i, playMs) === "warn";
        if (warn && !warnSeen[i]) sound.play("dive");
        warnSeen[i] = warn;
      }
    }
    updateFly(dt);
    updateSnake(dt, sec, mult);

    if (hopT < HOP_MS) hopT += dt;

    // Ride the log
    const lane = laneOf(frogRow);
    if (lane && isRiver(frogRow)) {
      frogX += lane.dir * lane.speed * mult * sec;
      if (!onLog() || frogX < 0 || frogX > W) {
        die("splash");
        return;
      }
    } else if ((isRoad(frogRow) && hitsVehicle()) || hitsSnake()) {
      die("squash");
      return;
    }

    timeLeft -= sec;
    if (timeLeft <= 0) {
      timeLeft = 0;
      die("timeout");
    }
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function render() {
    syncCallbacks();
    const t = Math.min(1, hopT / HOP_MS);
    const frog = {
      x: hopFromX + (frogX - hopFromX) * t,
      y: hopFromY + (rowY(frogRow) - hopFromY) * t,
      dying: dyingT >= 0,
      dyingT: dyingT >= 0 ? Math.min(1, dyingT / DEATH_MS) : 0,
    };
    drawFrame(ctx!, {
      fontFamily,
      skin,
      phases,
      frog,
      pads,
      timeFrac: timeLeft / TIME_LIMIT,
      playMs,
      flyPad: fly ? fly.pad : null,
      snake:
        level() >= SNAKE_FROM_LEVEL && snake.delay <= 0
          ? { x: snake.x, dir: snake.dir }
          : null,
      hint: ready && !gameOver ? "PRESS ARROW KEY OR SPACE TO START" : null,
    });
  }

  function loop(ts: number) {
    const frame = Math.min(ts - lastTime, MAX_FRAME_MS);
    lastTime = ts;
    if (!paused) accum += frame;
    while (accum >= STEP_MS) {
      update(STEP_MS);
      accum -= STEP_MS;
    }
    render();
    rafId = requestAnimationFrame(loop);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const isIgnoredTarget = (e: KeyboardEvent) =>
    IGNORED_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "");

  function start() {
    ready = false;
    sound.unlock();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e) || gameOver) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused || e.repeat) return;
    if (ready) {
      // The starting key only starts; the hop needs a second press.
      if (KEY_DIRS[e.code] || e.code === "Space") start();
      return;
    }
    const dir = KEY_DIRS[e.code];
    if (dir) hop(dir);
  };

  const onCanvasClick = () => {
    if (ready && !paused && !gameOver) start();
  };

  document.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("click", onCanvasClick);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function init() {
    phases = LANES.map(() => 0);
    pads = PAD_COLS.map(() => false);
    score = 0;
    lives = START_LIVES;
    roundsCleared = 0;
    playMs = 0;
    warnSeen = [];
    flyClock = 0;
    fly = null;
    snake = { x: -SNAKE_W, dir: 1, delay: SNAKE_DELAY_MS };
    ready = true;
    paused = false;
    gameOver = false;
    accum = 0;
    sentScore = -1;
    sentLives = -1;
    sentLevel = -1;
    respawn();
    hopFromX = START_X;
    hopFromY = rowY(START_ROW);
    render();
  }

  canvas.width = W;
  canvas.height = H;
  init();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(next) {
      if (next === paused || gameOver) return;
      paused = next;
      if (paused) sound.suspend();
      else {
        lastTime = performance.now();
        sound.resume();
      }
    },
    setMuted(next) {
      sound.setMuted(next);
    },
    setAppearance(next) {
      skin = next;
      render();
    },
    end: endGame,
    reset: init,
    destroy() {
      cancelAnimationFrame(rafId);
      sound.destroy();
      document.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("click", onCanvasClick);
    },
  };
}
