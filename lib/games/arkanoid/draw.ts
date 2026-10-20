// Arkanoid vector neon rendering (no spritesheet)

import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  H,
  W,
  type Block,
  type RowColor,
} from "./levels";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface FrameView {
  blocks: Block[];
  paddle: Rect;
  ball: Ball;
  fontFamily: string;
  ready: boolean; // pre-run screen: PRESS SPACE OR CLICK TO LAUNCH
  serveLevel: number | null; // ball stuck to paddle → LEVEL N banner + hint
  win: boolean; // YOU WIN banner
}

const BG = "#000";
const BANNER_COLOR = "#f5ff00";
const HINT_COLOR = "rgba(230, 233, 255, 0.7)";
const PADDLE_COLOR = "#00f5ff";
const BALL_COLOR = "#e6e9ff";

const ROW_HEX: Record<RowColor, string> = {
  gray: "#e6e9ff",
  red: "#ff006e",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#aa00ff",
  hotpink: "#ff7700",
  green: "#00ff88",
};

function drawBlock(ctx: CanvasRenderingContext2D, b: Block) {
  const color = ROW_HEX[b.color];
  ctx.fillStyle = color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
}

// Brick flash, then a shrink/fade over EXPLOSION_FRAMES steps.
function drawBreaking(
  ctx: CanvasRenderingContext2D,
  b: Block,
  elapsed: number,
) {
  const i = Math.min(
    EXPLOSION_FRAMES - 1,
    Math.floor(elapsed / (EXPLOSION_DURATION / EXPLOSION_FRAMES)),
  );
  const scale = 1 - i / EXPLOSION_FRAMES;
  const w = b.w * scale;
  const h = b.h * scale;
  ctx.globalAlpha = scale;
  ctx.fillStyle = i === 0 ? "#fff" : ROW_HEX[b.color];
  ctx.fillRect(b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: FrameView) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  for (const b of view.blocks) {
    if (b.alive) drawBlock(ctx, b);
    else if (b.breakElapsed !== null) drawBreaking(ctx, b, b.breakElapsed);
  }

  const p = view.paddle;
  ctx.shadowColor = PADDLE_COLOR;
  ctx.shadowBlur = 8;
  ctx.fillStyle = PADDLE_COLOR;
  roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();

  const ball = view.ball;
  ctx.shadowColor = BALL_COLOR;
  ctx.shadowBlur = 6;
  ctx.fillStyle = BALL_COLOR;
  ctx.fillRect(ball.x, ball.y, ball.size, ball.size);
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (view.ready) {
    drawText(
      ctx,
      "PRESS SPACE OR CLICK TO LAUNCH",
      H / 2 + 40,
      14,
      HINT_COLOR,
      view.fontFamily,
    );
  } else if (view.serveLevel !== null) {
    drawText(
      ctx,
      `LEVEL ${view.serveLevel}`,
      H / 2 + 40,
      28,
      BANNER_COLOR,
      view.fontFamily,
    );
    drawText(
      ctx,
      "SPACE / CLICK TO LAUNCH",
      H / 2 + 80,
      12,
      HINT_COLOR,
      view.fontFamily,
    );
  } else if (view.win) {
    drawText(ctx, "YOU WIN", H / 2 + 40, 36, BANNER_COLOR, view.fontFamily);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  color: string,
  fontFamily: string,
) {
  ctx.font = `${size}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}
