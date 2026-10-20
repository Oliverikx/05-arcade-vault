// Snake rendering — vector neon snake, sprite fruit with magenta fallback.

import { FRUITS } from "./sprites";

export const COLS = 20;
export const ROWS = 15;
export const CELL = 32;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 480

const FRUIT_BOX = 28;
const GREEN = "#00ff88";
const MAGENTA = "#ff006e";

export interface Cell {
  c: number;
  r: number;
}

export interface FrameView {
  fontFamily: string;
  snake: Cell[]; // head first
  fruit: Cell | null;
  fruitName: string;
  sheet: HTMLImageElement | null; // null until loaded
  hint: string | null; // centered text (ready / serve)
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(230, 233, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, H);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(W, r * CELL + 0.5);
  }
  ctx.stroke();
}

function drawFruit(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  name: string,
  sheet: HTMLImageElement | null,
) {
  const x = cell.c * CELL;
  const y = cell.r * CELL;
  const sprite = FRUITS[name];
  if (!sheet || !sprite) {
    const size = FRUIT_BOX - 8;
    const off = (CELL - size) / 2;
    ctx.fillStyle = MAGENTA;
    ctx.beginPath();
    ctx.roundRect(x + off, y + off, size, size, 4);
    ctx.fill();
    return;
  }
  // Scale to fit the box, keeping aspect ratio, centered in the cell.
  const scale = Math.min(FRUIT_BOX / sprite.w, FRUIT_BOX / sprite.h);
  const dw = sprite.w * scale;
  const dh = sprite.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    x + (CELL - dw) / 2,
    y + (CELL - dh) / 2,
    dw,
    dh,
  );
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: Cell[]) {
  // Body first so the glowing head sits on top.
  ctx.fillStyle = "rgba(0, 255, 136, 0.7)";
  for (let i = snake.length - 1; i >= 1; i--) {
    const { c, r } = snake[i];
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
  }
  if (snake.length === 0) return;
  const head = snake[0];
  ctx.save();
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 8;
  ctx.fillStyle = GREEN;
  ctx.fillRect(head.c * CELL + 1, head.r * CELL + 1, CELL - 2, CELL - 2);
  ctx.restore();
}

function drawHint(ctx: CanvasRenderingContext2D, text: string, font: string) {
  ctx.save();
  ctx.fillStyle = "rgba(230, 233, 255, 0.7)";
  ctx.font = `12px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + CELL * 3);
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: FrameView) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx);
  if (view.fruit) drawFruit(ctx, view.fruit, view.fruitName, view.sheet);
  drawSnake(ctx, view.snake);
  if (view.hint) drawHint(ctx, view.hint, view.fontFamily);
}
