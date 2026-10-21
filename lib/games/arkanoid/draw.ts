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
  skin: ArkanoidSkin;
}

export type ArkanoidSkin = "neon" | "retro" | "classic";

interface Palette {
  bg: string;
  rows: Record<RowColor, string>;
  flash: string;
  paddle: string;
  ball: string;
  banner: string;
  hint: string;
  glowPaddle: number;
  glowBall: number;
}

const PALETTES: Record<ArkanoidSkin, Palette> = {
  neon: {
    bg: "#000000",
    rows: {
      gray: "#e6e9ff",
      red: "#ff006e",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#aa00ff",
      hotpink: "#ff7700",
      green: "#00ff88",
    },
    flash: "#ffffff",
    paddle: "#00f5ff",
    ball: "#e6e9ff",
    banner: "#f5ff00",
    hint: "rgba(230, 233, 255, 0.7)",
    glowPaddle: 8,
    glowBall: 6,
  },
  retro: {
    bg: "#06100d",
    rows: {
      gray: "#c9c6b4",
      red: "#b8506a",
      yellow: "#d4a64a",
      cyan: "#6fb7b0",
      magenta: "#8a64a8",
      hotpink: "#c8803c",
      green: "#7dae7a",
    },
    flash: "#efe8cc",
    paddle: "#6fb7b0",
    ball: "#d9d2b8",
    banner: "#d4a64a",
    hint: "rgba(217, 210, 184, 0.7)",
    glowPaddle: 0,
    glowBall: 0,
  },
  classic: {
    bg: "#000000",
    rows: {
      gray: "#bcbcbc",
      red: "#fc0000",
      yellow: "#fcfc00",
      cyan: "#00fcfc",
      magenta: "#fc00fc",
      hotpink: "#fc7400",
      green: "#00fc00",
    },
    flash: "#ffffff",
    paddle: "#bcbcbc",
    ball: "#fcfcfc",
    banner: "#fcfc00",
    hint: "rgba(252, 252, 252, 0.7)",
    glowPaddle: 0,
    glowBall: 0,
  },
};

function drawBlock(ctx: CanvasRenderingContext2D, b: Block, pal: Palette) {
  const color = pal.rows[b.color];
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
  pal: Palette,
) {
  const i = Math.min(
    EXPLOSION_FRAMES - 1,
    Math.floor(elapsed / (EXPLOSION_DURATION / EXPLOSION_FRAMES)),
  );
  const scale = 1 - i / EXPLOSION_FRAMES;
  const w = b.w * scale;
  const h = b.h * scale;
  ctx.globalAlpha = scale;
  ctx.fillStyle = i === 0 ? pal.flash : pal.rows[b.color];
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
  const pal = PALETTES[view.skin];
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  for (const b of view.blocks) {
    if (b.alive) drawBlock(ctx, b, pal);
    else if (b.breakElapsed !== null) drawBreaking(ctx, b, b.breakElapsed, pal);
  }

  const p = view.paddle;
  if (pal.glowPaddle > 0) {
    ctx.shadowColor = pal.paddle;
    ctx.shadowBlur = pal.glowPaddle;
  }
  ctx.fillStyle = pal.paddle;
  roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();

  const ball = view.ball;
  if (pal.glowBall > 0) {
    ctx.shadowColor = pal.ball;
    ctx.shadowBlur = pal.glowBall;
  } else {
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = pal.ball;
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
      pal.hint,
      view.fontFamily,
    );
  } else if (view.serveLevel !== null) {
    drawText(
      ctx,
      `LEVEL ${view.serveLevel}`,
      H / 2 + 40,
      28,
      pal.banner,
      view.fontFamily,
    );
    drawText(
      ctx,
      "SPACE / CLICK TO LAUNCH",
      H / 2 + 80,
      12,
      pal.hint,
      view.fontFamily,
    );
  } else if (view.win) {
    drawText(ctx, "YOU WIN", H / 2 + 40, 36, pal.banner, view.fontFamily);
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
