// Minesweeper rendering — neon cells, numbers, flags, mines, strip and banners.

import type { BoardSpec, Cell } from "./board";

export const W = 640;
export const H = 480;
export const CELL = 32;
export const STRIP_H = 32;
const AREA_H = H - STRIP_H; // 448
const GLOW_BLUR = 8;

const NUMBER_COLORS = [
  "",
  "#00f5ff",
  "#00ff88",
  "#ff006e",
  "#f5ff00",
  "#d97a3a",
  "#ffcf3a",
  "#c7d0e0",
  "#e6e9ff",
];

export interface BoardLayout {
  ox: number;
  oy: number;
}

/** Board is centered inside the 640×448 area below the strip. */
export function layoutFor(spec: BoardSpec): BoardLayout {
  return {
    ox: Math.floor((W - spec.cols * CELL) / 2),
    oy: STRIP_H + Math.floor((AREA_H - spec.rows * CELL) / 2),
  };
}

export type Phase = "ready" | "playing" | "clear" | "gameover";

export interface FrameState {
  fontFamily: string;
  spec: BoardSpec;
  cells: Cell[];
  phase: Phase;
  minesLeft: number;
  seconds: number;
  level: number;
  cursor: number | null; // keyboard cursor, drawn only after keyboard use
  hover: number | null; // mouse hover
  hitIndex: number | null;
  hint: string | null;
  banner: string | null;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
const fmtMines = (n: number) =>
  n < 0 ? `-${String(-n).padStart(2, "0")}` : pad3(n);

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#f5ff00";
  ctx.fillRect(x + 11, y + 7, 2, 18); // pole
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 7);
  ctx.lineTo(x + 24, y + 12);
  ctx.lineTo(x + 13, y + 17);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + 8, y + 24, 10, 3); // base
}

function drawMine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hit: boolean,
) {
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  ctx.save();
  ctx.shadowColor = "#ff006e";
  ctx.shadowBlur = GLOW_BLUR;
  ctx.fillStyle = "#ff006e";
  ctx.strokeStyle = "#ff006e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
    ctx.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    ctx.stroke();
  }
  ctx.restore();
  if (hit) {
    ctx.strokeStyle = "#e6e9ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
  }
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "#ff006e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 6);
  ctx.lineTo(x + CELL - 6, y + CELL - 6);
  ctx.moveTo(x + CELL - 6, y + 6);
  ctx.lineTo(x + 6, y + CELL - 6);
  ctx.stroke();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  s: FrameState,
  i: number,
  x: number,
  y: number,
) {
  const cell = s.cells[i];
  const over = s.phase === "gameover";
  const showMine = over && cell.mine && !cell.flagged;
  const open = cell.revealed || showMine;

  if (open) {
    ctx.fillStyle = "#05050a";
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = "rgba(230, 233, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  } else {
    ctx.fillStyle = "#15151f";
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = "#4a4f70";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  }

  if (showMine || (cell.revealed && cell.mine)) {
    drawMine(ctx, x, y, i === s.hitIndex);
  } else if (cell.revealed && cell.adj > 0) {
    ctx.fillStyle = NUMBER_COLORS[cell.adj];
    ctx.font = `14px ${s.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(cell.adj), x + CELL / 2, y + CELL / 2 + 1);
  } else if (cell.flagged) {
    drawFlag(ctx, x, y);
    if (over && !cell.mine) drawCross(ctx, x, y);
  }
}

function outline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  ctx.restore();
}

function centerText(
  ctx: CanvasRenderingContext2D,
  s: FrameState,
  text: string,
  y: number,
  size: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#e6e9ff";
  ctx.font = `${size}px ${s.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Strip
  ctx.fillStyle = "#e6e9ff";
  ctx.font = `12px ${s.fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`MINES ${fmtMines(s.minesLeft)}`, 12, STRIP_H / 2);
  ctx.textAlign = "right";
  ctx.fillText(`TIME ${pad3(Math.min(999, s.seconds))}`, W - 12, STRIP_H / 2);

  // Board
  const { ox, oy } = layoutFor(s.spec);
  for (let i = 0; i < s.cells.length; i++) {
    const x = ox + (i % s.spec.cols) * CELL;
    const y = oy + Math.floor(i / s.spec.cols) * CELL;
    drawCell(ctx, s, i, x, y);
  }
  for (const idx of [s.hover, s.cursor]) {
    if (idx === null || s.phase === "gameover") continue;
    outline(
      ctx,
      ox + (idx % s.spec.cols) * CELL,
      oy + Math.floor(idx / s.spec.cols) * CELL,
      "#f5ff00",
    );
  }

  // Overlays
  if (s.banner) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, H / 2 - 36, W, 72);
    centerText(ctx, s, s.banner, H / 2, 22, 1);
  } else if (s.hint) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, H / 2 - 36, W, 72);
    if (s.phase === "ready" && s.level > 1) {
      centerText(ctx, s, `LEVEL ${s.level}`, H / 2 - 12, 18, 1);
      centerText(ctx, s, s.hint, H / 2 + 14, 11, 0.7);
    } else {
      centerText(ctx, s, s.hint, H / 2, 12, 0.7);
    }
  }
}
