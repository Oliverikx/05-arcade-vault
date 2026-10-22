// Froggy rendering — vector art drawn on canvas, in three skins.

import {
  CELL,
  H,
  LANES,
  ROWS,
  W,
  diveState,
  entityXs,
  type Lane,
} from "./lanes";

export const PAD_COLS = [1, 4, 7, 10, 13];

export type FroggySkin = "neon" | "retro" | "classic";

interface Palette {
  background: string;
  hedge: string;
  padLine: string;
  padIcon: string;
  river: string;
  logFill: string;
  logEdge: string;
  safe: string;
  safeLine: string | null; // null = no top line
  road: string;
  dash: string;
  car: string;
  truck: string;
  bus: string;
  frog: string;
  frogDying: string;
  timerHi: string;
  timerMid: string;
  timerLo: string;
  hint: string;
  shellRgb: string; // "r, g, b"
  shellAlpha: number;
  shellEdge: string;
  ripple: string;
  fly: string;
  snake: string;
  bigGlow: number; // frog, filled pad
  smallGlow: number; // vehicles, fly, snake
}

const PALETTES: Record<FroggySkin, Palette> = {
  neon: {
    background: "#000000",
    hedge: "#003a2a",
    padLine: "#00ff88",
    padIcon: "#00ff88",
    river: "rgba(0, 245, 255, 0.12)",
    logFill: "#d97a3a",
    logEdge: "#ffcf3a",
    safe: "#0f0f18",
    safeLine: "rgba(0, 255, 136, 0.3)",
    road: "#15151f",
    dash: "rgba(230, 233, 255, 0.12)",
    car: "#ff006e",
    truck: "#f5ff00",
    bus: "#00f5ff",
    frog: "#00ff88",
    frogDying: "#ff006e",
    timerHi: "#00ff88",
    timerMid: "#f5ff00",
    timerLo: "#ff006e",
    hint: "rgba(230, 233, 255, 0.7)",
    shellRgb: "0, 255, 136",
    shellAlpha: 0.8,
    shellEdge: "#00f5ff",
    ripple: "rgba(0, 245, 255, 0.25)",
    fly: "#f5ff00",
    snake: "#ff006e",
    bigGlow: 8,
    smallGlow: 4,
  },
  retro: {
    background: "#06100d",
    hedge: "#1c3a2c",
    padLine: "#7dae7a",
    padIcon: "#7dae7a",
    river: "rgba(111, 163, 168, 0.14)",
    logFill: "#8a5a34",
    logEdge: "#b89a52",
    safe: "#0c1612",
    safeLine: "rgba(125, 174, 122, 0.3)",
    road: "#101613",
    dash: "rgba(217, 210, 184, 0.12)",
    car: "#b8607a",
    truck: "#c2b36a",
    bus: "#6fa3a8",
    frog: "#7dae7a",
    frogDying: "#b8607a",
    timerHi: "#7dae7a",
    timerMid: "#c2b36a",
    timerLo: "#b8607a",
    hint: "rgba(217, 210, 184, 0.7)",
    shellRgb: "125, 174, 122",
    shellAlpha: 0.8,
    shellEdge: "#6fa3a8",
    ripple: "rgba(111, 163, 168, 0.25)",
    fly: "#c2b36a",
    snake: "#b8607a",
    bigGlow: 0,
    smallGlow: 0,
  },
  classic: {
    background: "#000000",
    hedge: "#008000",
    padLine: "#ffff00",
    padIcon: "#00ff00",
    river: "#0000a8",
    logFill: "#8b4513",
    logEdge: "#8b4513",
    safe: "#800080",
    safeLine: null,
    road: "#000000",
    dash: "#808080",
    car: "#ff0000",
    truck: "#ffff00",
    bus: "#ffffff",
    frog: "#00ff00",
    frogDying: "#ff0000",
    timerHi: "#00ff00",
    timerMid: "#ffff00",
    timerLo: "#ff0000",
    hint: "#ffffff",
    shellRgb: "0, 200, 0",
    shellAlpha: 1,
    shellEdge: "#00c800",
    ripple: "rgba(255, 255, 255, 0.25)",
    fly: "#ffffff",
    snake: "#ff00ff",
    bigGlow: 0,
    smallGlow: 0,
  },
};

export interface FrogView {
  x: number; // visual center
  y: number;
  dying: boolean;
  dyingT: number; // 0..1 progress of the death animation
}

export interface FrameView {
  fontFamily: string;
  skin: FroggySkin;
  phases: number[]; // per LANES entry
  frog: FrogView | null;
  pads: boolean[];
  timeFrac: number; // 0..1
  playMs: number; // playing time, drives the turtle dive cycle
  flyPad: number | null; // pad index showing a fly
  snake: { x: number; dir: 1 | -1 } | null; // median snake (left x)
  hint: string | null;
}

function laneColor(p: Palette, kind: Lane["kind"]): string {
  switch (kind) {
    case "car":
      return p.car;
    case "truck":
      return p.truck;
    case "bus":
      return p.bus;
    default:
      return p.logFill;
  }
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  if (blur <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const s = size / 28;
  ctx.fillStyle = color;
  ctx.fillRect(x - 9 * s, y - 8 * s, 18 * s, 18 * s); // body
  ctx.fillRect(x - 12 * s, y - 12 * s, 6 * s, 6 * s); // front legs
  ctx.fillRect(x + 6 * s, y - 12 * s, 6 * s, 6 * s);
  ctx.fillRect(x - 12 * s, y + 6 * s, 6 * s, 6 * s); // back legs
  ctx.fillRect(x + 6 * s, y + 6 * s, 6 * s, 6 * s);
  ctx.fillStyle = "#000";
  ctx.fillRect(x - 6 * s, y - 6 * s, 3 * s, 3 * s); // eyes
  ctx.fillRect(x + 3 * s, y - 6 * s, 3 * s, 3 * s);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  pads: boolean[],
) {
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);

  // Goal hedge
  ctx.fillStyle = p.hedge;
  ctx.fillRect(0, 0, W, CELL);

  // River
  ctx.fillStyle = p.river;
  ctx.fillRect(0, CELL, W, CELL * 4);

  // Median + start
  for (const row of [5, 11]) {
    ctx.fillStyle = p.safe;
    ctx.fillRect(0, row * CELL, W, CELL);
    if (p.safeLine) {
      ctx.fillStyle = p.safeLine;
      ctx.fillRect(0, row * CELL, W, 1);
    }
  }

  // Road
  ctx.fillStyle = p.road;
  ctx.fillRect(0, 6 * CELL, W, CELL * 5);
  ctx.strokeStyle = p.dash;
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 12]);
  for (let row = 7; row <= 10; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * CELL + 0.5);
    ctx.lineTo(W, row * CELL + 0.5);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Pads
  PAD_COLS.forEach((col, i) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(col * CELL + 2, 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = p.padLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL + 2, 2, CELL - 4, CELL - 4);
    if (pads[i]) {
      ctx.save();
      glow(ctx, p.padIcon, p.bigGlow);
      drawFrogShape(ctx, col * CELL + CELL / 2, CELL / 2, 22, p.padIcon);
      ctx.restore();
    }
  });
}

function drawTurtle(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
  playMs: number,
  index: number,
) {
  const state = diveState(index, playMs);
  const cy = y + CELL / 2;
  if (state === "under") {
    ctx.strokeStyle = p.ripple;
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + k * CELL + CELL / 2, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  const blinkOn = Math.floor(playMs / 150) % 2 === 0;
  const alpha = state === "warn" ? (blinkOn ? 1 : 0.3) : p.shellAlpha;
  const r = state === "warn" ? 10 : 14;
  for (let k = 0; k < 3; k++) {
    const cx = x + k * CELL + CELL / 2;
    ctx.fillStyle = `rgba(${p.shellRgb}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.shellEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawEntities(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  phases: number[],
  playMs: number,
) {
  LANES.forEach((lane, i) => {
    const color = laneColor(p, lane.kind);
    entityXs(lane, phases[i]).forEach((x, idx) => {
      const w = lane.w * CELL;
      if (x + w < 0 || x > W) return;
      const y = lane.row * CELL;
      if (lane.kind === "turtle") {
        drawTurtle(ctx, p, x, y, playMs, idx);
      } else if (lane.kind === "log") {
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 6, w, CELL - 12);
        ctx.strokeStyle = p.logEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 6.5, w - 1, CELL - 13);
      } else {
        ctx.save();
        glow(ctx, color, p.smallGlow);
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 8, w - 4, CELL - 16);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.55)"; // windshield on the leading end
        const wx = lane.dir === 1 ? x + w - 10 : x + 5;
        ctx.fillRect(wx, y + 12, 5, CELL - 24);
      }
    });
  });
}

function drawFly(ctx: CanvasRenderingContext2D, p: Palette, pad: number) {
  const cx = PAD_COLS[pad] * CELL + CELL / 2;
  const cy = CELL / 2;
  ctx.save();
  glow(ctx, p.fly, p.smallGlow);
  ctx.fillStyle = p.fly;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  ctx.strokeStyle = p.fly;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 3);
  ctx.lineTo(cx - 9, cy - 9);
  ctx.moveTo(cx + 2, cy - 3);
  ctx.lineTo(cx + 9, cy - 9);
  ctx.stroke();
  ctx.restore();
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  dir: 1 | -1,
) {
  const y = 5 * CELL + CELL / 2;
  ctx.save();
  glow(ctx, p.snake, p.smallGlow);
  ctx.fillStyle = p.snake;
  for (let k = 0; k < 5; k++) {
    ctx.fillRect(x + 4 + k * 14, y - 6 + (k % 2 === 0 ? -2 : 2), 12, 12);
  }
  ctx.restore();
  ctx.fillStyle = "#000"; // eye on the head end
  ctx.fillRect(dir === 1 ? x + 4 + 4 * 14 + 6 : x + 6, y - 6, 3, 3);
}

function drawTimer(ctx: CanvasRenderingContext2D, p: Palette, frac: number) {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = f > 0.5 ? p.timerHi : f >= 0.25 ? p.timerMid : p.timerLo;
  ctx.fillRect(0, H - 6, W * f, 6);
}

export function drawFrame(ctx: CanvasRenderingContext2D, v: FrameView) {
  const p = PALETTES[v.skin];
  drawBackground(ctx, p, v.pads);
  drawEntities(ctx, p, v.phases, v.playMs);
  if (v.flyPad !== null) drawFly(ctx, p, v.flyPad);
  if (v.snake) drawSnake(ctx, p, v.snake.x, v.snake.dir);

  if (v.frog) {
    const f = v.frog;
    const dim = f.dying && Math.floor(f.dyingT * 8) % 2 === 1;
    const color = f.dying ? p.frogDying : p.frog;
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    glow(ctx, color, p.bigGlow);
    drawFrogShape(ctx, f.x, f.y, 28, color);
    ctx.restore();
  }

  drawTimer(ctx, p, v.timeFrac);

  if (v.hint) {
    ctx.font = `14px ${v.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, (ROWS * CELL) / 2 - 24, W, 40);
    ctx.fillStyle = p.hint;
    ctx.fillText(v.hint, W / 2, (ROWS * CELL) / 2 + 2);
  }
}
