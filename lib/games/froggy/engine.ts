// Froggy engine — framework-free, new game (no source port).

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { PAD_COLS, drawFrame } from "./draw";
import {
  CELL,
  H,
  LANES,
  W,
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

export function createFroggyGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine {
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

  function die() {
    if (dyingT >= 0) return;
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
    if (pads.every(Boolean)) {
      addScore(PTS_LEVEL);
      roundsCleared++;
      pads = PAD_COLS.map(() => false);
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
      (x) => frogX >= x && frogX <= x + w,
    );
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
      if (i < 0 || pads[i]) die();
      else fillPad(i);
      return;
    }
    if (isRiver(frogRow)) {
      if (!onLog()) die();
      return;
    }
    frogX = Math.min(620, Math.max(20, frogX));
    if (isRoad(frogRow) && hitsVehicle()) die();
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

    LANES.forEach((lane, i) => {
      const m = modulusOf(lane);
      phases[i] = (phases[i] + lane.dir * lane.speed * mult * sec) % m;
    });

    if (dyingT >= 0) {
      dyingT += dt;
      if (dyingT >= DEATH_MS) finishDeath();
      return;
    }

    if (hopT < HOP_MS) hopT += dt;

    // Ride the log
    const lane = laneOf(frogRow);
    if (lane && isRiver(frogRow)) {
      frogX += lane.dir * lane.speed * mult * sec;
      if (!onLog() || frogX < 0 || frogX > W) {
        die();
        return;
      }
    } else if (isRoad(frogRow) && hitsVehicle()) {
      die();
      return;
    }

    timeLeft -= sec;
    if (timeLeft <= 0) {
      timeLeft = 0;
      die();
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
      phases,
      frog,
      pads,
      timeFrac: timeLeft / TIME_LIMIT,
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e) || gameOver) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused || e.repeat) return;
    if (ready) {
      // The starting key only starts; the hop needs a second press.
      if (KEY_DIRS[e.code] || e.code === "Space") ready = false;
      return;
    }
    const dir = KEY_DIRS[e.code];
    if (dir) hop(dir);
  };

  const onCanvasClick = () => {
    if (ready && !paused && !gameOver) ready = false;
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
      if (!paused) lastTime = performance.now();
    },
    end: endGame,
    reset: init,
    destroy() {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("click", onCanvasClick);
    },
  };
}
