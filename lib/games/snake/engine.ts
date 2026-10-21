// Snake engine — framework-free, new game (no source port).

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { COLS, H, ROWS, W, drawFrame, type Cell, type SnakeSkin } from "./draw";
import { FRUITS, FRUIT_SHEET } from "./sprites";

type Dir = "up" | "down" | "left" | "right";

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;
const START_LENGTH = 3;
const START_LIVES = 3;
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const MAX_QUEUE = 2;
const MAX_SCORE = 10_000_000;

const VECTORS: Record<Dir, Cell> = {
  up: { c: 0, r: -1 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
  right: { c: 1, r: 0 },
};
const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
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
const FRUIT_NAMES = Object.keys(FRUITS);

const levelFor = (fruitsEaten: number) =>
  1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
const tickFor = (level: number) => Math.max(60, 150 - 10 * (level - 1));

function startSnake(): Cell[] {
  const headC = Math.floor(COLS / 2);
  const headR = Math.floor(ROWS / 2);
  // Heading right: body trails to the left of the head.
  return Array.from({ length: START_LENGTH }, (_, i) => ({
    c: headC - i,
    r: headR,
  }));
}

export type { SnakeSkin };

export interface SnakeEngine extends GameEngine {
  setAppearance(skin: SnakeSkin): void; // redraws now
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): SnakeEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Canvas can't read CSS vars directly; resolve the platform pixel font once.
  const fontFamily =
    getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";

  let snake: Cell[] = startSnake();
  let dir: Dir = "right"; // direction of the last executed tick
  let queue: Dir[] = []; // pending turns, consumed one per tick
  let growPending = 0;
  let fruit: Cell | null = null;
  let fruitName = "";
  let score = 0;
  let lives = START_LIVES;
  let fruitsEaten = 0;
  let ready = true; // fresh run, nothing started yet
  let serve = true; // waiting for a key (ready, or after a lost life)
  let paused = false;
  let gameOver = false;
  let tickAccum = 0;
  let accum = 0;
  let lastTime = 0;
  let rafId = 0;
  let skin: SnakeSkin = "neon";

  // Last values sent to callbacks, so they fire only on change
  let sentScore = -1;
  let sentLives = -1;
  let sentLevel = -1;

  let sheet: HTMLImageElement | null = null;
  const img = new Image();
  img.onload = () => {
    sheet = img;
  };
  img.src = FRUIT_SHEET;

  // ── Fruit ─────────────────────────────────────────────────────────────────
  function freeCells(): Cell[] {
    const taken = new Set(snake.map((s) => s.r * COLS + s.c));
    const free: Cell[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!taken.has(r * COLS + c)) free.push({ c, r });
    return free;
  }

  // Returns false when no free cell is left (board full).
  function spawnFruit(): boolean {
    const free = freeCells();
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    fruit = free[Math.floor(Math.random() * free.length)];
    const names = FRUIT_NAMES.filter((n) => n !== fruitName);
    fruitName = names[Math.floor(Math.random() * names.length)];
    return true;
  }

  function syncCallbacks() {
    const level = levelFor(fruitsEaten);
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  function endGame() {
    if (gameOver) return;
    gameOver = true;
    syncCallbacks();
    callbacks.onGameOver(score);
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    snake = startSnake();
    dir = "right";
    queue = [];
    growPending = 0;
    tickAccum = 0;
    serve = true;
    // The fruit stays put unless the reset snake covers it.
    if (fruit && snake.some((s) => s.c === fruit!.c && s.r === fruit!.r))
      spawnFruit();
  }

  function tick() {
    const next = queue.shift();
    if (next) dir = next;
    const v = VECTORS[dir];
    const head = { c: snake[0].c + v.c, r: snake[0].r + v.r };

    if (head.c < 0 || head.c >= COLS || head.r < 0 || head.r >= ROWS) {
      loseLife();
      return;
    }
    // The tail cell is vacated this tick unless the snake is growing.
    const body = growPending > 0 ? snake : snake.slice(0, -1);
    if (body.some((s) => s.c === head.c && s.r === head.r)) {
      loseLife();
      return;
    }

    snake.unshift(head);
    if (growPending > 0) growPending--;
    else snake.pop();

    if (fruit && head.c === fruit.c && head.r === fruit.r) {
      score = Math.min(MAX_SCORE, Math.max(0, score + POINTS_PER_FRUIT));
      fruitsEaten++;
      growPending++;
      if (!spawnFruit()) endGame(); // board full = win
    }
  }

  function update(dt: number) {
    if (serve || paused || gameOver) return;
    tickAccum += dt;
    const tickMs = tickFor(levelFor(fruitsEaten));
    while (tickAccum >= tickMs && !serve && !gameOver) {
      tickAccum -= tickMs;
      tick();
    }
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function render() {
    syncCallbacks();
    drawFrame(ctx!, {
      fontFamily,
      snake,
      fruit,
      fruitName,
      sheet,
      skin,
      hint: gameOver
        ? null
        : ready
          ? "PRESS ARROW KEY OR SPACE TO START"
          : serve
            ? "PRESS ARROW KEY TO CONTINUE"
            : null,
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

  function start() {
    ready = false;
    serve = false;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  // Validate against the last queued turn, not the current heading, so a fast
  // up-then-left cannot reverse the snake in place.
  function steer(next: Dir): boolean {
    if (queue.length >= MAX_QUEUE) return false;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (next === last || next === OPPOSITE[last]) return false;
    queue.push(next);
    return true;
  }

  const isIgnoredTarget = (e: KeyboardEvent) =>
    IGNORED_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "");

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e) || gameOver) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused) return;
    const turn = KEY_DIRS[e.code];
    if (serve) {
      if (turn) {
        if (turn === OPPOSITE[dir]) return; // reverse key does not start
        steer(turn);
        start();
      } else if (e.code === "Space") {
        start();
      }
      return;
    }
    if (turn) steer(turn);
  };

  const onCanvasClick = () => {
    if (serve && !paused && !gameOver) start();
  };

  const onBlur = () => {
    queue = [];
  };

  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("click", onCanvasClick);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function init() {
    snake = startSnake();
    dir = "right";
    queue = [];
    growPending = 0;
    score = 0;
    lives = START_LIVES;
    fruitsEaten = 0;
    fruitName = "";
    ready = true;
    serve = true;
    paused = false;
    gameOver = false;
    tickAccum = 0;
    accum = 0;
    sentScore = -1;
    sentLives = -1;
    sentLevel = -1;
    spawnFruit();
    render();
  }

  canvas.width = W;
  canvas.height = H;
  init();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  return {
    setAppearance(next) {
      skin = next;
      render();
    },
    setPaused(next) {
      if (next === paused || gameOver) return;
      paused = next;
      if (!paused) lastTime = performance.now();
    },
    end: endGame,
    reset: init,
    destroy() {
      cancelAnimationFrame(rafId);
      img.onload = null;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("click", onCanvasClick);
    },
  };
}
