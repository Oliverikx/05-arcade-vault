// Snake rendering — vector snake in three skins, sprite fruit with flat fallback.

import { FRUITS } from "./sprites";

export const COLS = 20;
export const ROWS = 15;
export const CELL = 32;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 480

const FRUIT_BOX = 28;
const GLOW_BLUR = 8;

export type SnakeSkin = "neon" | "retro" | "classic";

interface Palette {
  background: string;
  grid: string | null; // null = grid not drawn
  head: string;
  body: string;
  fruit: string; // fallback square when the sprite is missing
  hint: string;
  glow: string | null; // head shadowColor, null = no glow
}

const PALETTES: Record<SnakeSkin, Palette> = {
  neon: {
    background: "#000000",
    grid: "rgba(230, 233, 255, 0.06)",
    head: "#00ff88",
    body: "rgba(0, 255, 136, 0.7)",
    fruit: "#ff006e",
    hint: "rgba(230, 233, 255, 0.7)",
    glow: "#00ff88",
  },
  retro: {
    background: "#06100d",
    grid: "rgba(217, 210, 184, 0.06)",
    head: "#7dae7a",
    body: "rgba(125, 174, 122, 0.7)",
    fruit: "#b8607a",
    hint: "rgba(217, 210, 184, 0.7)",
    glow: null,
  },
  classic: {
    background: "#000000",
    grid: null,
    head: "#00ff00",
    body: "#00c800",
    fruit: "#ff0000",
    hint: "#ffffff",
    glow: null,
  },
};

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
  skin: SnakeSkin;
}

function drawGrid(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
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
  fallback: string,
) {
  const x = cell.c * CELL;
  const y = cell.r * CELL;
  const sprite = FRUITS[name];
  if (!sheet || !sprite) {
    const size = FRUIT_BOX - 8;
    const off = (CELL - size) / 2;
    ctx.fillStyle = fallback;
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

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Cell[],
  palette: Palette,
) {
  // Body first so the head sits on top.
  ctx.fillStyle = palette.body;
  for (let i = snake.length - 1; i >= 1; i--) {
    const { c, r } = snake[i];
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
  }
  if (snake.length === 0) return;
  const head = snake[0];
  ctx.save();
  if (palette.glow) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = GLOW_BLUR;
  }
  ctx.fillStyle = palette.head;
  ctx.fillRect(head.c * CELL + 1, head.r * CELL + 1, CELL - 2, CELL - 2);
  ctx.restore();
}

function drawHint(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `12px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + CELL * 3);
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: FrameView) {
  const palette = PALETTES[view.skin];
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, H);
  if (palette.grid) drawGrid(ctx, palette.grid);
  if (view.fruit)
    drawFruit(ctx, view.fruit, view.fruitName, view.sheet, palette.fruit);
  drawSnake(ctx, view.snake, palette);
  if (view.hint) drawHint(ctx, view.hint, view.fontFamily, palette.hint);
}
