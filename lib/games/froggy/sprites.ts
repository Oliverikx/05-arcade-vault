// Froggy glow sprites — pre-rendered once per skin so the per-frame path
// blits images instead of paying canvas shadowBlur on every entity.

import { CELL } from "./lanes";

// Extra pixels around each sprite so the glow is never clipped (blur <= 8).
const MARGIN = 16;

export type VehicleKind = "car" | "truck" | "bus";
type Dir = 1 | -1;

const VEHICLE_CELLS: Record<VehicleKind, number> = { car: 1, truck: 2, bus: 3 };
const SNAKE_W = 2 * CELL;
const FROG_SIZE = 28;
const PAD_ICON_SIZE = 22;

export interface Sprite {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Where the entity anchor sits inside the canvas (glow margin included). */
  ox: number;
  oy: number;
}

export interface FroggySprites {
  vehicle: Record<VehicleKind, Record<Dir, Sprite>>;
  fly: Sprite;
  snake: Record<Dir, Sprite>;
  frog: Sprite;
  frogDying: Sprite;
  padIcon: Sprite;
}

/** The slice of the skin palette the sprites need. */
export interface SpritePalette {
  car: string;
  truck: string;
  bus: string;
  fly: string;
  snake: string;
  frog: string;
  frogDying: string;
  padIcon: string;
  bigGlow: number; // frog, filled pad
  smallGlow: number; // vehicles, fly, snake
}

type DrawFrog = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) => void;

const cache = new Map<string, FroggySprites>();

function make(
  w: number,
  h: number,
  ox: number,
  oy: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  paint(ctx);
  return { canvas, ox, oy };
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  if (blur <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function vehicleSprite(
  color: string,
  blur: number,
  cells: number,
  dir: Dir,
): Sprite {
  const w = cells * CELL;
  return make(w + 2 * MARGIN, CELL + 2 * MARGIN, MARGIN, MARGIN, (ctx) => {
    ctx.save();
    glow(ctx, color, blur);
    ctx.fillStyle = color;
    ctx.fillRect(MARGIN + 2, MARGIN + 8, w - 4, CELL - 16);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.55)"; // windshield on the leading end
    const wx = dir === 1 ? MARGIN + w - 10 : MARGIN + 5;
    ctx.fillRect(wx, MARGIN + 12, 5, CELL - 24);
  });
}

function flySprite(p: SpritePalette): Sprite {
  const half = 9 + MARGIN;
  return make(2 * half, 2 * half, half, half, (ctx) => {
    ctx.save();
    glow(ctx, p.fly, p.smallGlow);
    ctx.fillStyle = p.fly;
    ctx.fillRect(half - 3, half - 3, 6, 6);
    ctx.strokeStyle = p.fly;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half - 2, half - 3);
    ctx.lineTo(half - 9, half - 9);
    ctx.moveTo(half + 2, half - 3);
    ctx.lineTo(half + 9, half - 9);
    ctx.stroke();
    ctx.restore();
  });
}

// Anchor: left edge of the snake, vertical center of the median row.
function snakeSprite(p: SpritePalette, dir: Dir): Sprite {
  const half = 8 + MARGIN;
  return make(SNAKE_W + 2 * MARGIN, 2 * half, MARGIN, half, (ctx) => {
    ctx.save();
    glow(ctx, p.snake, p.smallGlow);
    ctx.fillStyle = p.snake;
    for (let k = 0; k < 5; k++) {
      ctx.fillRect(
        MARGIN + 4 + k * 14,
        half - 6 + (k % 2 === 0 ? -2 : 2),
        12,
        12,
      );
    }
    ctx.restore();
    ctx.fillStyle = "#000"; // eye on the head end
    ctx.fillRect(
      dir === 1 ? MARGIN + 4 + 4 * 14 + 6 : MARGIN + 6,
      half - 6,
      3,
      3,
    );
  });
}

function frogSprite(
  drawFrog: DrawFrog,
  size: number,
  color: string,
  blur: number,
): Sprite {
  const half = Math.ceil(size / 2) + MARGIN;
  return make(2 * half, 2 * half, half, half, (ctx) => {
    glow(ctx, color, blur);
    drawFrog(ctx, half, half, size, color);
  });
}

export function buildSprites(
  p: SpritePalette,
  drawFrog: DrawFrog,
): FroggySprites {
  const vehicle = {} as FroggySprites["vehicle"];
  for (const kind of ["car", "truck", "bus"] as const) {
    vehicle[kind] = {
      1: vehicleSprite(p[kind], p.smallGlow, VEHICLE_CELLS[kind], 1),
      "-1": vehicleSprite(p[kind], p.smallGlow, VEHICLE_CELLS[kind], -1),
    };
  }
  return {
    vehicle,
    fly: flySprite(p),
    snake: { 1: snakeSprite(p, 1), "-1": snakeSprite(p, -1) },
    frog: frogSprite(drawFrog, FROG_SIZE, p.frog, p.bigGlow),
    frogDying: frogSprite(drawFrog, FROG_SIZE, p.frogDying, p.bigGlow),
    padIcon: frogSprite(drawFrog, PAD_ICON_SIZE, p.padIcon, p.bigGlow),
  };
}

/** Sprites for a skin, built on first use and cached until the page unloads. */
export function getSprites(
  skin: string,
  p: SpritePalette,
  drawFrog: DrawFrog,
): FroggySprites {
  let sprites = cache.get(skin);
  if (!sprites) {
    sprites = buildSprites(p, drawFrog);
    cache.set(skin, sprites);
  }
  return sprites;
}

export function blit(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
) {
  ctx.drawImage(s.canvas, x - s.ox, y - s.oy);
}
