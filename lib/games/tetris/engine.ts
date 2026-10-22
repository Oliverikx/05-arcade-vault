// Tetris engine — framework-free port of resources/started-games/03-tetris/game.js

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { H, W, drawFrame } from "./draw";
import {
  COLS,
  ENERGY_MAX,
  ENERGY_PER_LINE,
  KICKS,
  LINE_SCORES,
  MAX_SCORE,
  PREVIEW_COUNT,
  PREVIEW_PIECES,
  ROWS,
  SLOW_FACTOR,
  SLOW_MS,
  collide,
  createBoard,
  intervalFor,
  makePiece,
  randomType,
  rotateCW,
  shapeOf,
  type Board,
  type Piece,
  type TetrisSkin,
  type TetrisTheme,
} from "./pieces";

export type { TetrisSkin, TetrisTheme } from "./pieces";

export interface TetrisEngine extends GameEngine {
  setAppearance(skin: TetrisSkin, theme: TetrisTheme): void; // redraws now
}

interface UndoSnapshot {
  board: Board;
  type: number;
  score: number;
  lines: number;
  level: number;
  dropInterval: number;
}

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];
const IGNORED_TARGETS = ["INPUT", "SELECT", "TEXTAREA"];

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): TetrisEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Canvas can't read CSS vars directly; resolve the platform pixel font once.
  const fontFamily =
    getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";

  let skin: TetrisSkin = "neon";
  let theme: TetrisTheme = "dark";

  let board: Board = createBoard();
  let current: Piece = makePiece(1);
  let queue: Piece[] = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let ready = true; // waiting for Space / click to start
  let paused = false;
  let gameOver = false;
  let choosing = false;
  let lastTime = 0;
  let dropAccum = 0;
  let dropInterval = intervalFor(1);
  let rafId = 0;
  let energy = 0;
  let previewLeft = 0;
  let slowMs = 0;
  let held: Piece | null = null;
  let holdReady = false;
  let undoSnap: UndoSnapshot | null = null;

  // Last values sent to callbacks, so they fire only on change
  let sentScore = -1;
  let sentLevel = -1;

  const pressed = new Set<string>(); // keys currently held
  let blocked = new Set<string>(); // keys held at resume; ignored until released

  const randomPiece = () => makePiece(randomType());

  function fillQueue() {
    while (queue.length < PREVIEW_COUNT + 1) queue.push(randomPiece());
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(board, current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function addScore(points: number) {
    score = Math.min(MAX_SCORE, score + points);
  }

  // Also covers state restores (undo): callers just render().
  function syncCallbacks() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
  }

  function render() {
    syncCallbacks();
    drawFrame(ctx!, {
      ready,
      skin,
      theme,
      fontFamily,
      board,
      current,
      ghostY: gameOver ? null : ghostY(),
      queue,
      held,
      previewLeft,
      lines,
      energy,
      slowMs,
      choosing,
      canUndo: undoSnap !== null,
    });
  }

  // ── Loop control ──────────────────────────────────────────────────────────
  function stopLoop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function startLoop() {
    stopLoop();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // The loop runs only while nothing freezes it.
  function syncLoop() {
    if (ready || paused || choosing || gameOver) stopLoop();
    else if (!rafId) startLoop();
    render();
  }

  function loop(ts: number) {
    const dt = ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (slowMs > 0) slowMs = Math.max(0, slowMs - dt);
    if (dropAccum >= dropInterval * (slowMs > 0 ? SLOW_FACTOR : 1)) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    render();
    if (ready || paused || choosing || gameOver) {
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      addScore((LINE_SCORES[cleared] || 0) * level);
      level = Math.max(1, Math.floor(lines / 10) + 1);
      dropInterval = intervalFor(level);
      energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    }
  }

  function hardDrop() {
    const gy = ghostY();
    addScore((gy - current.y) * 2);
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      addScore(1);
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    undoSnap = {
      board: board.map((r) => [...r]),
      type: current.type,
      score,
      lines,
      level,
      dropInterval,
    };
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = queue.shift()!;
    fillQueue();
    if (previewLeft > 0) previewLeft--;
    if (collide(board, current.shape, current.x, current.y)) {
      // keep only the cells that fit in free board spaces
      const { x, y } = current;
      current.shape = current.shape.map((row, r) =>
        row.map((v, c) => (v && !collide(board, [[v]], x + c, y + r) ? v : 0)),
      );
      endGame();
    }
  }

  // Updates the ability-menu flag and notifies the UI only on change.
  function setChoosing(next: boolean) {
    if (choosing === next) return;
    choosing = next;
    callbacks.onAbilityMenu?.(next);
  }

  function endGame() {
    gameOver = true;
    setChoosing(false);
    syncLoop();
    callbacks.onGameOver(score);
  }

  function startRun() {
    ready = false;
    blocked = new Set(pressed); // the starting Space must not hard-drop
    syncLoop();
  }

  // ── Abilities ─────────────────────────────────────────────────────────────
  function abilityPreview() {
    previewLeft = PREVIEW_PIECES + 1; // +1: current spawn decrement already happened
    return true;
  }

  function abilitySwap() {
    let type: number;
    do {
      type = randomType();
    } while (type === current.type);
    const shape = shapeOf(type);
    for (const kick of KICKS) {
      if (!collide(board, shape, current.x + kick, current.y)) {
        current = { type, shape, x: current.x + kick, y: current.y };
        return true;
      }
    }
    return false;
  }

  function abilitySlow() {
    slowMs = SLOW_MS;
    return true;
  }

  function abilityUndo() {
    if (!undoSnap) return false;
    board = undoSnap.board;
    score = undoSnap.score;
    lines = undoSnap.lines;
    level = undoSnap.level;
    dropInterval = undoSnap.dropInterval;
    queue.unshift(makePiece(current.type));
    current = makePiece(undoSnap.type);
    undoSnap = null;
    return true;
  }

  function abilityHold() {
    if (held) return false;
    held = makePiece(current.type);
    holdReady = true;
    spawn();
    return true;
  }

  const ABILITIES: Record<string, () => boolean> = {
    "1": abilityPreview,
    "2": abilitySwap,
    "3": abilitySlow,
    "4": abilityUndo,
    "5": abilityHold,
  };

  function swapInHeld() {
    if (!holdReady || !held) return;
    queue.unshift(makePiece(current.type));
    current = makePiece(held.type);
    held = null;
    holdReady = false;
    if (collide(board, current.shape, current.x, current.y)) endGame();
  }

  function openAbilityMenu() {
    if (energy < ENERGY_MAX || paused || gameOver || choosing) return;
    setChoosing(true);
    syncLoop();
  }

  function closeAbilityMenu() {
    if (!choosing) return;
    setChoosing(false);
    syncLoop();
  }

  function pickAbility(id: string) {
    const fn = ABILITIES[id];
    if (!choosing || !fn || !fn()) return;
    energy = 0;
    closeAbilityMenu();
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const isIgnoredTarget = (e: KeyboardEvent) =>
    IGNORED_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "");

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e) || gameOver) return;
    pressed.add(e.code);
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused) return;
    if (ready) {
      if (e.code === "Space") startRun();
      return;
    }

    // While the menu is open, Esc/P belong to the engine (GamePlayer skips
    // defaultPrevented events), so Esc cancels the menu instead of pausing.
    if (choosing && (e.code === "Escape" || e.code === "KeyP")) {
      e.preventDefault();
      if (e.code === "Escape") closeAbilityMenu();
      return;
    }
    if (blocked.has(e.code)) return;
    if (choosing) {
      if (/^(Digit|Numpad)[1-5]$/.test(e.code)) pickAbility(e.code.slice(-1));
      return;
    }

    switch (e.code) {
      case "KeyE":
        openAbilityMenu();
        return;
      case "KeyC":
        swapInHeld();
        break;
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    render();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    pressed.delete(e.code);
    blocked.delete(e.code);
  };

  const onCanvasClick = () => {
    if (ready && !paused) startRun();
  };

  const onBlur = () => {
    pressed.clear();
    blocked.clear();
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    ready = true;
    gameOver = false;
    setChoosing(false);
    dropInterval = intervalFor(level);
    dropAccum = 0;
    energy = 0;
    previewLeft = 0;
    slowMs = 0;
    held = null;
    holdReady = false;
    undoSnap = null;
    queue = [];
    fillQueue();
    spawn();
    blocked = new Set(pressed);
    sentScore = -1;
    sentLevel = -1;
    syncLoop();
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("click", onCanvasClick);

  canvas.width = W;
  canvas.height = H;
  init();

  return {
    setPaused(next) {
      if (next === paused || gameOver) return;
      paused = next;
      if (!paused) blocked = new Set(pressed);
      syncLoop();
    },
    end() {
      if (!gameOver) endGame();
    },
    reset: init,
    destroy() {
      stopLoop();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("click", onCanvasClick);
    },
    setAppearance(nextSkin, nextTheme) {
      skin = nextSkin;
      theme = nextTheme;
      render();
    },
  };
}
