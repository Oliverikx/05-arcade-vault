// Minesweeper engine — framework-free, new game (no source port).

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import {
  boardForLevel,
  chord,
  createCells,
  pickHintCell,
  placeMines,
  reveal,
  type BoardSpec,
  type Cell,
} from "./board";
import { CELL, H, W, drawFrame, layoutFor, type Phase } from "./draw";
import { createSound } from "./sound";

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;
const LOSS_DELAY_MS = 1000;
const CLEAR_BANNER_MS = 1500;
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 8;
const MAX_SECONDS = 999;
const HINTS_PER_BOARD = 2;
const HINT_COST = 100;
const HINT_PULSE_MS = 600;
const MAX_SCORE = 10_000_000;

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};
const GAME_KEYS = [...Object.keys(KEY_MOVES), "Space", "KeyF", "KeyH"];
const IGNORED_TARGETS = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"];

interface Press {
  index: number;
  x: number;
  y: number;
  pointerId: number;
  fired: boolean; // long press already flagged
}

export interface MinesweeperEngine extends GameEngine {
  hint(): void;
  setMuted(muted: boolean): void;
}

export function createMinesweeperGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): MinesweeperEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Canvas can't read CSS vars directly; resolve the platform pixel font once.
  const fontFamily =
    getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";

  const sound = createSound();

  let level = 1;
  let spec: BoardSpec = boardForLevel(1);
  let cells: Cell[] = createCells(spec);
  let phase: Phase = "ready";
  let hintShown = true;
  let score = 0;
  let boardMs = 0;
  let phaseMs = 0; // time left in the loss delay / clear banner
  let hitIndex: number | null = null;
  let hintsLeft = HINTS_PER_BOARD;
  let pulse: { index: number; ms: number } | null = null;
  let cursor: number | null = null;
  let kbUsed = false;
  let hover: number | null = null;
  let paused = false;
  let finished = false; // onGameOver already fired
  let accum = 0;
  let lastTime = 0;
  let rafId = 0;

  let press: Press | null = null;
  let pressTimer = 0;

  // Last values sent to callbacks, so they fire only on change
  let sentScore = -1;
  let sentLevel = -1;
  let sentHints = "";

  const seconds = () => Math.min(MAX_SECONDS, Math.floor(boardMs / 1000));
  const clamp = (n: number) => Math.min(MAX_SCORE, Math.max(0, n));

  function syncCallbacks() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
    const hints = `${hintsLeft}:${phase === "playing"}`;
    if (hints !== sentHints) {
      sentHints = hints;
      callbacks.onHints?.(hintsLeft, phase === "playing");
    }
  }

  function newBoard() {
    spec = boardForLevel(level);
    cells = createCells(spec);
    phase = "ready";
    hintShown = true;
    boardMs = 0;
    hitIndex = null;
    hintsLeft = HINTS_PER_BOARD;
    pulse = null;
    cursor = null;
    hover = null;
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  function finish() {
    if (finished) return;
    finished = true;
    syncCallbacks();
    callbacks.onGameOver(score);
  }

  function lose() {
    phase = "gameover";
    phaseMs = LOSS_DELAY_MS;
    hitIndex = cells.findIndex((c) => c.mine && c.revealed);
    if (hitIndex < 0) hitIndex = null;
  }

  function checkClear() {
    const safe = cells.length - spec.mines;
    if (cells.filter((c) => c.revealed).length < safe) return;
    score = clamp(score + 500 * level + 2 * Math.max(0, 300 - seconds()));
    phase = "clear";
    phaseMs = CLEAR_BANNER_MS;
  }

  function applyResult(
    res: { opened: number; hitMine: boolean },
    chorded = false,
  ) {
    score = clamp(score + res.opened * 10 * level);
    if (res.hitMine) {
      lose();
      sound.play("lose");
      return;
    }
    checkClear();
    if (phase === "clear") sound.play("clear");
    else if (chorded) {
      if (res.opened > 0) sound.play("chord");
    } else sound.play(res.opened > 1 ? "flood" : "reveal");
  }

  const interactive = () =>
    !paused && (phase === "ready" || phase === "playing");

  function revealAt(index: number) {
    if (!interactive()) return;
    const cell = cells[index];
    if (cell.revealed) {
      if (phase === "playing") applyResult(chord(cells, spec, index), true);
      return;
    }
    if (cell.flagged) return;
    if (phase === "ready") {
      placeMines(cells, spec, index, Math.random);
      phase = "playing";
      boardMs = 0;
      hintShown = false;
    }
    applyResult(reveal(cells, spec, index));
  }

  function flagAt(index: number) {
    if (!interactive()) return;
    const cell = cells[index];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    hintShown = false;
    sound.play(cell.flagged ? "flag" : "unflag");
  }

  function hint() {
    if (paused || phase !== "playing" || hintsLeft <= 0 || score < HINT_COST) {
      return;
    }
    const index = pickHintCell(cells, spec, Math.random);
    if (index === null) return;
    score -= HINT_COST;
    hintsLeft--;
    cells[index].flagged = false; // a wrong flag on a safe cell gives way
    const res = reveal(cells, spec, index);
    pulse = { index, ms: HINT_PULSE_MS };
    checkClear(); // hint reveals award no cell points
    sound.play(
      (phase as Phase) === "clear"
        ? "clear"
        : res.opened > 1
          ? "flood"
          : "reveal",
    );
  }

  function update(dt: number) {
    if (paused || finished) return;
    if (pulse) {
      pulse.ms -= dt;
      if (pulse.ms <= 0) pulse = null;
    }
    if (phase === "playing") {
      const before = Math.floor(boardMs / 1000);
      boardMs += dt;
      const after = Math.floor(boardMs / 1000);
      if (after > before && after >= 290 && after <= 299) sound.play("tick");
    } else if (phase === "clear") {
      phaseMs -= dt;
      if (phaseMs <= 0) {
        level++;
        newBoard();
      }
    } else if (phase === "gameover") {
      phaseMs -= dt;
      if (phaseMs <= 0) finish();
    }
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function render() {
    syncCallbacks();
    const flags = cells.filter((c) => c.flagged).length;
    drawFrame(ctx!, {
      fontFamily,
      spec,
      cells,
      phase,
      minesLeft: spec.mines - flags,
      seconds: seconds(),
      level,
      cursor: kbUsed ? cursor : null,
      hover,
      hitIndex,
      pulse: pulse
        ? { index: pulse.index, alpha: pulse.ms / HINT_PULSE_MS }
        : null,
      hint:
        phase === "ready" && hintShown ? "CLICK OR PRESS SPACE TO START" : null,
      banner: phase === "clear" ? "BOARD CLEARED" : null,
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
  // Maps a pointer event to a board index; the canvas is CSS-scaled.
  function cellAt(e: PointerEvent): number | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const { ox, oy } = layoutFor(spec);
    const c = Math.floor((x - ox) / CELL);
    const r = Math.floor((y - oy) / CELL);
    if (c < 0 || c >= spec.cols || r < 0 || r >= spec.rows) return null;
    return r * spec.cols + c;
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    press = null;
  }

  const isIgnoredTarget = (e: KeyboardEvent) =>
    IGNORED_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "");

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e) || finished) return;
    if (GAME_KEYS.includes(e.code)) sound.unlock();
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!interactive()) return;
    const move = KEY_MOVES[e.code];
    if (move) {
      if (cursor === null) {
        cursor =
          Math.floor(spec.rows / 2) * spec.cols + Math.floor(spec.cols / 2);
      }
      const c = Math.min(
        spec.cols - 1,
        Math.max(0, (cursor % spec.cols) + move[0]),
      );
      const r = Math.min(
        spec.rows - 1,
        Math.max(0, Math.floor(cursor / spec.cols) + move[1]),
      );
      cursor = r * spec.cols + c;
      kbUsed = true;
      hintShown = false;
      return;
    }
    if (e.code === "KeyH") {
      hint();
      return;
    }
    if (e.code !== "Space" && e.code !== "KeyF") return;
    if (cursor === null) {
      cursor =
        Math.floor(spec.rows / 2) * spec.cols + Math.floor(spec.cols / 2);
    }
    kbUsed = true;
    if (e.code === "Space") revealAt(cursor);
    else flagAt(cursor);
  };

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    sound.unlock();
    if (!interactive()) return;
    const index = cellAt(e);
    if (index === null) return;
    cursor = index;
    hover = e.pointerType === "mouse" ? index : null;
    if (e.pointerType === "mouse" && e.button === 2) {
      flagAt(index);
      return;
    }
    if (e.button !== 0) return;
    cancelPress();
    press = {
      index,
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      fired: false,
    };
    pressTimer = window.setTimeout(() => {
      if (!press) return;
      press.fired = true;
      flagAt(press.index);
    }, LONG_PRESS_MS);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!press || press.pointerId !== e.pointerId) return;
    const { index, fired } = press;
    cancelPress();
    if (fired) return; // long press already flagged; swallow the release
    revealAt(index);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") hover = cellAt(e);
    if (
      press &&
      press.pointerId === e.pointerId &&
      Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_MOVE_PX
    ) {
      cancelPress();
    }
  };

  const onPointerLeave = () => {
    hover = null;
    cancelPress();
  };

  const onContextMenu = (e: Event) => e.preventDefault();
  const onBlur = () => cancelPress();

  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", cancelPress);
  canvas.addEventListener("contextmenu", onContextMenu);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function init() {
    cancelPress();
    level = 1;
    score = 0;
    kbUsed = false;
    paused = false;
    finished = false;
    accum = 0;
    phaseMs = 0;
    sentScore = -1;
    sentLevel = -1;
    sentHints = "";
    newBoard();
    render();
  }

  canvas.width = W;
  canvas.height = H;
  init();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(next) {
      if (next === paused || finished) return;
      paused = next;
      if (paused) cancelPress();
      else lastTime = performance.now();
    },
    end() {
      if (finished) return;
      if (phase !== "gameover") lose();
      finish();
    },
    hint,
    setMuted(muted) {
      sound.setMuted(muted);
    },
    reset: init,
    destroy() {
      cancelAnimationFrame(rafId);
      sound.destroy();
      cancelPress();
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", cancelPress);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
