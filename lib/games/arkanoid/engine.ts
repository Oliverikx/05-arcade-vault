// Arkanoid engine — framework-free port of resources/started-games/04-arkanoid/game.js

import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { drawFrame, type Ball, type Rect } from "./draw";
import {
  BALL_SIZE,
  EXPLOSION_DURATION,
  H,
  LAUNCH_ANGLE,
  LEVELS,
  MAX_BOUNCE_ANGLE,
  MAX_FRAME_MS,
  MAX_SCORE,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BLOCK,
  START_LIVES,
  STEP_MS,
  W,
  WIN_BONUS_PER_LIFE,
  WIN_STEPS,
  buildBlocks,
  levelSpeed,
  type Block,
} from "./levels";

export interface ArkanoidEngine extends GameEngine {
  setMuted(muted: boolean): void;
}

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "Space"];
const IGNORED_TARGETS = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"];
const SOUND_BASE = "/games/arkanoid/sounds";

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): ArkanoidEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Canvas can't read CSS vars directly; resolve the platform pixel font once.
  const fontFamily =
    getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";

  let phase: "ready" | "playing" | "gameover" = "ready";
  let serve = true; // playing: ball stuck to paddle, waiting for launch
  let winSteps = 0; // > 0: YOU WIN banner counting down
  let paused = false;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let blocks: Block[] = [];
  const paddle: Rect = {
    x: (W - PADDLE_W) / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE };

  let lastTime = 0;
  let accumulator = 0;
  let rafId = 0;

  // Last values sent to callbacks, so they fire only on change
  let sentScore = -1;
  let sentLives = -1;
  let sentLevel = -1;

  let muted = false;
  const sounds = {
    bounce: new Audio(`${SOUND_BASE}/ball-bounce.mp3`),
    brk: new Audio(`${SOUND_BASE}/break-sound.mp3`),
  };
  sounds.bounce.preload = "auto";
  sounds.brk.preload = "auto";

  // Only called from update() while playing, i.e. after a launch gesture.
  function playSound(audio: HTMLAudioElement) {
    if (muted) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  const keys = { left: false, right: false };

  function clampPaddle() {
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  }

  function stickBallToPaddle() {
    ball.x = paddle.x + (paddle.w - ball.size) / 2;
    ball.y = paddle.y - ball.size;
    ball.vx = 0;
    ball.vy = 0;
  }

  function addScore(points: number) {
    score = Math.max(0, Math.min(MAX_SCORE, score + points));
  }

  function syncCallbacks() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
  }

  function loadLevel(n: number) {
    level = n;
    blocks = buildBlocks(n - 1);
    paddle.x = (W - paddle.w) / 2;
    serve = true;
    stickBallToPaddle();
  }

  function endGame() {
    if (phase === "gameover") return;
    phase = "gameover";
    serve = false;
    winSteps = 0;
    syncCallbacks();
    callbacks.onGameOver(score);
  }

  function launchBall() {
    if (paused || winSteps > 0) return;
    if (phase !== "ready" && !(phase === "playing" && serve)) return;
    const rad = (LAUNCH_ANGLE * Math.PI) / 180;
    ball.vx = levelSpeed(level) * Math.sin(rad);
    ball.vy = -levelSpeed(level) * Math.cos(rad);
    phase = "playing";
    serve = false;
  }

  // ── Simulation (fixed step) ───────────────────────────────────────────────
  function update() {
    if (keys.left) paddle.x -= PADDLE_SPEED;
    if (keys.right) paddle.x += PADDLE_SPEED;
    clampPaddle();

    for (const block of blocks) {
      if (block.breakElapsed === null) continue;
      block.breakElapsed += STEP_MS;
      if (block.breakElapsed >= EXPLOSION_DURATION) block.breakElapsed = null;
    }

    if (winSteps > 0) {
      if (--winSteps === 0) {
        addScore(lives * WIN_BONUS_PER_LIFE);
        endGame();
      }
      return;
    }

    // last block hit: freeze the ball until its break animation ends
    if (phase === "playing" && !blocks.some((blk) => blk.alive)) {
      if (!blocks.some((blk) => blk.breakElapsed !== null)) {
        if (level < LEVELS.length) loadLevel(level + 1);
        else winSteps = WIN_STEPS;
      }
      return;
    }

    if (phase === "ready" || (phase === "playing" && serve)) {
      stickBallToPaddle();
      return;
    }
    if (phase !== "playing") return;

    let bounced = false;
    let broke = false;
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < 0) {
      ball.x = 0;
      ball.vx = -ball.vx;
      bounced = true;
    } else if (ball.x + ball.size > W) {
      ball.x = W - ball.size;
      ball.vx = -ball.vx;
      bounced = true;
    }
    if (ball.y < 0) {
      ball.y = 0;
      ball.vy = -ball.vy;
      bounced = true;
    }

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        endGame();
      } else {
        serve = true;
        stickBallToPaddle();
      }
      return;
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.size > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.size > paddle.y &&
      ball.y < paddle.y + paddle.h
    ) {
      const hit =
        (ball.x + ball.size / 2 - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const clamped = Math.max(-1, Math.min(1, hit));
      const rad = (clamped * MAX_BOUNCE_ANGLE * Math.PI) / 180;
      ball.vx = levelSpeed(level) * Math.sin(rad);
      ball.vy = -levelSpeed(level) * Math.cos(rad);
      ball.y = paddle.y - ball.size;
      bounced = true;
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (
        ball.x + ball.size <= block.x ||
        ball.x >= block.x + block.w ||
        ball.y + ball.size <= block.y ||
        ball.y >= block.y + block.h
      )
        continue;

      block.alive = false;
      block.breakElapsed = 0;
      addScore(POINTS_PER_BLOCK);
      broke = true;

      // reflect on the axis with the smaller overlap
      const overlapX = Math.min(
        ball.x + ball.size - block.x,
        block.x + block.w - ball.x,
      );
      const overlapY = Math.min(
        ball.y + ball.size - block.y,
        block.y + block.h - ball.y,
      );
      if (overlapX < overlapY) {
        ball.vx = -ball.vx;
        ball.x +=
          ball.x + ball.size / 2 < block.x + block.w / 2 ? -overlapX : overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y +=
          ball.y + ball.size / 2 < block.y + block.h / 2 ? -overlapY : overlapY;
      }
      break; // one block per step
    }

    if (broke) playSound(sounds.brk);
    else if (bounced) playSound(sounds.bounce);
  }

  function render() {
    syncCallbacks();
    drawFrame(ctx!, {
      blocks,
      paddle,
      ball,
      fontFamily,
      ready: phase === "ready",
      serveLevel: phase === "playing" && serve ? level : null,
      win: winSteps > 0,
    });
  }

  function loop(ts: number) {
    if (paused) {
      accumulator = 0;
    } else {
      accumulator += Math.min(ts - lastTime, MAX_FRAME_MS);
      while (accumulator >= STEP_MS) {
        update();
        accumulator -= STEP_MS;
      }
    }
    lastTime = ts;
    render();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    lastTime = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const isIgnoredTarget = (e: KeyboardEvent) =>
    IGNORED_TARGETS.includes((e.target as HTMLElement | null)?.tagName ?? "");

  function setKey(e: KeyboardEvent, down: boolean) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = down;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = down;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isIgnoredTarget(e)) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused || phase === "gameover") return;
    setKey(e, true);
    if (e.code === "Space") launchBall();
  };

  const onKeyUp = (e: KeyboardEvent) => setKey(e, false);

  const onMouseMove = (e: MouseEvent) => {
    if (paused || phase === "gameover") return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = mouseX - paddle.w / 2;
    clampPaddle();
  };

  const onMouseDown = () => {
    if (phase !== "gameover") launchBall();
  };

  const onBlur = () => {
    keys.left = false;
    keys.right = false;
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);

  function init() {
    phase = "ready";
    paused = false;
    winSteps = 0;
    score = 0;
    lives = START_LIVES;
    keys.left = false;
    keys.right = false;
    sentScore = -1;
    sentLives = -1;
    sentLevel = -1;
    loadLevel(1);
    render();
  }

  canvas.width = W;
  canvas.height = H;
  init();
  startLoop();

  return {
    setPaused(next) {
      if (phase === "gameover") return;
      paused = next;
    },
    end: endGame,
    reset: init,
    setMuted(next) {
      muted = next;
      if (muted) {
        sounds.bounce.pause();
        sounds.brk.pause();
      }
    },
    destroy() {
      stopLoop();
      sounds.bounce.pause();
      sounds.brk.pause();
      sounds.bounce.removeAttribute("src");
      sounds.brk.removeAttribute("src");
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
    },
  };
}
