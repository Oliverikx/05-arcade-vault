// Minesweeper rendering — cells, numbers, flags, mines, strip and banners in three skins.

import type { BoardSpec, Cell } from "./board";

export const W = 640;
export const H = 480;
export const CELL = 32;
export const STRIP_H = 32;
const AREA_H = H - STRIP_H; // 448

export type MinesweeperSkin = "neon" | "retro" | "classic";

interface Palette {
  background: string;
  stripBg: string;
  stripText: string;
  stripBox: string | null; // classic: readouts sit on a black box
  hiddenFill: string;
  hiddenBorder: string;
  bevel: { light: string; dark: string } | null; // classic hidden cells
  cursor: string;
  cursorWidth: number;
  cursorGlow: number;
  revealedFill: string;
  revealedBorder: string;
  numbers: string[]; // index 1..8
  flag: string;
  flagPole: string;
  mine: string;
  mineGlow: number;
  mineHighlight: string | null;
  hitRing: string | null;
  hitFill: string | null;
  cross: string;
  pulse: string;
  pulseGlow: number;
  text: string;
  panel: string | null; // classic: banners sit on a solid panel
}

const PALETTES: Record<MinesweeperSkin, Palette> = {
  neon: {
    background: "#000000",
    stripBg: "#000000",
    stripText: "#e6e9ff",
    stripBox: null,
    hiddenFill: "#15151f",
    hiddenBorder: "#4a4f70",
    bevel: null,
    cursor: "#f5ff00",
    cursorWidth: 2,
    cursorGlow: 6,
    revealedFill: "#05050a",
    revealedBorder: "rgba(230, 233, 255, 0.06)",
    numbers: [
      "",
      "#00f5ff",
      "#00ff88",
      "#ff006e",
      "#f5ff00",
      "#d97a3a",
      "#ffcf3a",
      "#c7d0e0",
      "#e6e9ff",
    ],
    flag: "#f5ff00",
    flagPole: "#f5ff00",
    mine: "#ff006e",
    mineGlow: 8,
    mineHighlight: null,
    hitRing: "#e6e9ff",
    hitFill: null,
    cross: "#ff006e",
    pulse: "#f5ff00",
    pulseGlow: 8,
    text: "#e6e9ff",
    panel: null,
  },
  retro: {
    background: "#06100d",
    stripBg: "#0c1612",
    stripText: "#d9d2b8",
    stripBox: null,
    hiddenFill: "#14201b",
    hiddenBorder: "#3d5247",
    bevel: null,
    cursor: "#c2b36a",
    cursorWidth: 2,
    cursorGlow: 0,
    revealedFill: "#050a08",
    revealedBorder: "rgba(217, 210, 184, 0.08)",
    numbers: [
      "",
      "#6fa3a8",
      "#7dae7a",
      "#b8607a",
      "#c2b36a",
      "#8a5a34",
      "#b89a52",
      "#a8b0a8",
      "#d9d2b8",
    ],
    flag: "#c2b36a",
    flagPole: "#c2b36a",
    mine: "#b8607a",
    mineGlow: 0,
    mineHighlight: null,
    hitRing: "#d9d2b8",
    hitFill: null,
    cross: "#b8607a",
    pulse: "#c2b36a",
    pulseGlow: 0,
    text: "#d9d2b8",
    panel: null,
  },
  classic: {
    background: "#c0c0c0",
    stripBg: "#c0c0c0",
    stripText: "#ff0000",
    stripBox: "#000000",
    hiddenFill: "#c0c0c0",
    hiddenBorder: "#808080",
    bevel: { light: "#ffffff", dark: "#808080" },
    cursor: "#000000",
    cursorWidth: 2,
    cursorGlow: 0,
    revealedFill: "#c0c0c0",
    revealedBorder: "#808080",
    numbers: [
      "",
      "#0000ff",
      "#008000",
      "#ff0000",
      "#000080",
      "#800000",
      "#008080",
      "#000000",
      "#808080",
    ],
    flag: "#ff0000",
    flagPole: "#000000",
    mine: "#000000",
    mineGlow: 0,
    mineHighlight: "#ffffff",
    hitRing: null,
    hitFill: "#ff0000",
    cross: "#ff0000",
    pulse: "#ffff00",
    pulseGlow: 0,
    text: "#000000",
    panel: "#c0c0c0",
  },
};

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
  skin: MinesweeperSkin;
  spec: BoardSpec;
  cells: Cell[];
  phase: Phase;
  minesLeft: number;
  seconds: number;
  level: number;
  cursor: number | null; // keyboard cursor, drawn only after keyboard use
  hover: number | null; // mouse hover
  hitIndex: number | null;
  pulse: { index: number; alpha: number } | null; // hint highlight, alpha 1 → 0
  hint: string | null;
  banner: string | null;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
const fmtMines = (n: number) =>
  n < 0 ? `-${String(-n).padStart(2, "0")}` : pad3(n);

function drawFlag(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
) {
  ctx.fillStyle = p.flagPole;
  ctx.fillRect(x + 11, y + 7, 2, 18); // pole
  ctx.fillRect(x + 8, y + 24, 10, 3); // base
  ctx.fillStyle = p.flag;
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 7);
  ctx.lineTo(x + 24, y + 12);
  ctx.lineTo(x + 13, y + 17);
  ctx.closePath();
  ctx.fill();
}

function drawMine(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
  hit: boolean,
) {
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  ctx.save();
  if (p.mineGlow > 0) {
    ctx.shadowColor = p.mine;
    ctx.shadowBlur = p.mineGlow;
  }
  ctx.fillStyle = p.mine;
  ctx.strokeStyle = p.mine;
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
  if (p.mineHighlight) {
    ctx.fillStyle = p.mineHighlight;
    ctx.fillRect(cx - 4, cy - 4, 3, 3);
  }
  if (hit && p.hitRing) {
    ctx.strokeStyle = p.hitRing;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
  }
}

function drawCross(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
) {
  ctx.strokeStyle = p.cross;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 6);
  ctx.lineTo(x + CELL - 6, y + CELL - 6);
  ctx.moveTo(x + CELL - 6, y + 6);
  ctx.lineTo(x + 6, y + CELL - 6);
  ctx.stroke();
}

function drawHidden(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
) {
  ctx.fillStyle = p.hiddenFill;
  ctx.fillRect(x, y, CELL, CELL);
  if (p.bevel) {
    const t = 3;
    ctx.fillStyle = p.bevel.light; // top and left edges
    ctx.fillRect(x, y, CELL, t);
    ctx.fillRect(x, y, t, CELL);
    ctx.fillStyle = p.bevel.dark; // bottom and right edges
    ctx.fillRect(x, y + CELL - t, CELL, t);
    ctx.fillRect(x + CELL - t, y, t, CELL);
    return;
  }
  ctx.strokeStyle = p.hiddenBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  s: FrameState,
  i: number,
  x: number,
  y: number,
) {
  const cell = s.cells[i];
  const over = s.phase === "gameover";
  const showMine = over && cell.mine && !cell.flagged;
  const open = cell.revealed || showMine;
  const isHit = i === s.hitIndex;

  if (open) {
    ctx.fillStyle = isHit && p.hitFill ? p.hitFill : p.revealedFill;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = p.revealedBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  } else {
    drawHidden(ctx, p, x, y);
  }

  if (showMine || (cell.revealed && cell.mine)) {
    drawMine(ctx, p, x, y, isHit);
  } else if (cell.revealed && cell.adj > 0) {
    ctx.fillStyle = p.numbers[cell.adj];
    ctx.font = `14px ${s.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(cell.adj), x + CELL / 2, y + CELL / 2 + 1);
  } else if (cell.flagged) {
    drawFlag(ctx, p, x, y);
    if (over && !cell.mine) drawCross(ctx, p, x, y);
  }
}

function outline(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.strokeStyle = p.cursor;
  if (p.cursorGlow > 0) {
    ctx.shadowColor = p.cursor;
    ctx.shadowBlur = p.cursorGlow;
  }
  ctx.lineWidth = p.cursorWidth;
  ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  ctx.restore();
}

function centerText(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  s: FrameState,
  text: string,
  y: number,
  size: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.text;
  ctx.font = `${size}px ${s.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

function readout(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  text: string,
  x: number,
  align: CanvasTextAlign,
) {
  ctx.textAlign = align;
  if (p.stripBox) {
    const w = ctx.measureText(text).width;
    const left = align === "left" ? x : x - w;
    ctx.fillStyle = p.stripBox;
    ctx.fillRect(left - 6, 5, w + 12, STRIP_H - 10);
  }
  ctx.fillStyle = p.stripText;
  ctx.fillText(text, x, STRIP_H / 2);
}

export function drawFrame(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = PALETTES[s.skin];
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);

  // Strip
  ctx.fillStyle = p.stripBg;
  ctx.fillRect(0, 0, W, STRIP_H);
  ctx.font = `12px ${s.fontFamily}`;
  ctx.textBaseline = "middle";
  readout(ctx, p, `MINES ${fmtMines(s.minesLeft)}`, 12, "left");
  readout(ctx, p, `TIME ${pad3(Math.min(999, s.seconds))}`, W - 12, "right");

  // Board
  const { ox, oy } = layoutFor(s.spec);
  for (let i = 0; i < s.cells.length; i++) {
    const x = ox + (i % s.spec.cols) * CELL;
    const y = oy + Math.floor(i / s.spec.cols) * CELL;
    drawCell(ctx, p, s, i, x, y);
  }
  for (const idx of [s.hover, s.cursor]) {
    if (idx === null || s.phase === "gameover") continue;
    outline(
      ctx,
      p,
      ox + (idx % s.spec.cols) * CELL,
      oy + Math.floor(idx / s.spec.cols) * CELL,
    );
  }
  if (s.pulse) {
    ctx.save();
    ctx.globalAlpha = s.pulse.alpha;
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.pulse;
    if (p.pulseGlow > 0) {
      ctx.shadowColor = p.pulse;
      ctx.shadowBlur = p.pulseGlow;
    }
    ctx.strokeRect(
      ox + (s.pulse.index % s.spec.cols) * CELL + 2,
      oy + Math.floor(s.pulse.index / s.spec.cols) * CELL + 2,
      CELL - 4,
      CELL - 4,
    );
    ctx.restore();
  }

  // Overlays
  const text = s.banner ?? s.hint;
  if (!text) return;
  ctx.fillStyle = p.panel ?? "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, H / 2 - 36, W, 72);
  if (s.banner) {
    centerText(ctx, p, s, s.banner, H / 2, 22, 1);
  } else if (s.phase === "ready" && s.level > 1) {
    centerText(ctx, p, s, `LEVEL ${s.level}`, H / 2 - 12, 18, 1);
    centerText(ctx, p, s, text, H / 2 + 14, 11, 0.7);
  } else {
    centerText(ctx, p, s, text, H / 2, 12, 0.7);
  }
}
