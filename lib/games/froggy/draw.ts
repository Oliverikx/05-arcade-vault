// Froggy rendering — vector neon drawn on canvas.

import { CELL, H, LANES, ROWS, W, entityXs, type Lane } from "./lanes";

const GLOW = 8;
const CAR_GLOW = 4;

export const PAD_COLS = [1, 4, 7, 10, 13];

export interface FrogView {
  x: number; // visual center
  y: number;
  dying: boolean;
  dyingT: number; // 0..1 progress of the death animation
}

export interface FrameView {
  fontFamily: string;
  phases: number[]; // per LANES entry
  frog: FrogView | null;
  pads: boolean[];
  timeFrac: number; // 0..1
  hint: string | null;
}

const LANE_COLOR: Record<Lane["kind"], string> = {
  car: "#ff006e",
  truck: "#f5ff00",
  bus: "#00f5ff",
  log: "#d97a3a",
};

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
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

function drawBackground(ctx: CanvasRenderingContext2D, pads: boolean[]) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Goal hedge
  ctx.fillStyle = "#003a2a";
  ctx.fillRect(0, 0, W, CELL);

  // River
  ctx.fillStyle = "rgba(0, 245, 255, 0.12)";
  ctx.fillRect(0, CELL, W, CELL * 4);

  // Median + start
  for (const row of [5, 11]) {
    ctx.fillStyle = "#0f0f18";
    ctx.fillRect(0, row * CELL, W, CELL);
    ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
    ctx.fillRect(0, row * CELL, W, 1);
  }

  // Road
  ctx.fillStyle = "#15151f";
  ctx.fillRect(0, 6 * CELL, W, CELL * 5);
  ctx.strokeStyle = "rgba(230, 233, 255, 0.12)";
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
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL + 2, 2, CELL - 4, CELL - 4);
    if (pads[i]) {
      glow(ctx, "#00ff88", GLOW);
      drawFrogShape(ctx, col * CELL + CELL / 2, CELL / 2, 22, "#00ff88");
      noGlow(ctx);
    }
  });
}

function drawEntities(ctx: CanvasRenderingContext2D, phases: number[]) {
  LANES.forEach((lane, i) => {
    const color = LANE_COLOR[lane.kind];
    const isLog = lane.kind === "log";
    for (const x of entityXs(lane, phases[i])) {
      const w = lane.w * CELL;
      if (x + w < 0 || x > W) continue;
      const y = lane.row * CELL;
      if (isLog) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 6, w, CELL - 12);
        ctx.strokeStyle = "#ffcf3a";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 6.5, w - 1, CELL - 13);
      } else {
        glow(ctx, color, CAR_GLOW);
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 8, w - 4, CELL - 16);
        noGlow(ctx);
        ctx.fillStyle = "rgba(0,0,0,0.55)"; // windshield on the leading end
        const wx = lane.dir === 1 ? x + w - 10 : x + 5;
        ctx.fillRect(wx, y + 12, 5, CELL - 24);
      }
    }
  });
}

function drawTimer(ctx: CanvasRenderingContext2D, frac: number) {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = f > 0.5 ? "#00ff88" : f >= 0.25 ? "#f5ff00" : "#ff006e";
  ctx.fillRect(0, H - 6, W * f, 6);
}

export function drawFrame(ctx: CanvasRenderingContext2D, v: FrameView) {
  drawBackground(ctx, v.pads);
  drawEntities(ctx, v.phases);

  if (v.frog) {
    const f = v.frog;
    const flash = f.dying && Math.floor(f.dyingT * 8) % 2 === 0;
    const color = f.dying ? (flash ? "#ff006e" : "#6b0030") : "#00ff88";
    glow(ctx, color, GLOW);
    drawFrogShape(ctx, f.x, f.y, 28, color);
    noGlow(ctx);
  }

  drawTimer(ctx, v.timeFrac);

  if (v.hint) {
    ctx.font = `14px ${v.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, (ROWS * CELL) / 2 - 24, W, 40);
    ctx.fillStyle = "rgba(230, 233, 255, 0.7)";
    ctx.fillText(v.hint, W / 2, (ROWS * CELL) / 2 + 2);
  }
}
