// Tetris canvas rendering: 800×600, board 300×600 centered, panels left/right.

import {
  BLOCK,
  COLS,
  ENERGY_MAX,
  PREVIEW_COUNT,
  ROWS,
  SKIN_COLORS,
  type Board,
  type Piece,
  type Shape,
  type TetrisSkin,
  type TetrisTheme,
} from "./pieces";

export const W = 800;
export const H = 600;
const BOARD_X = (W - COLS * BLOCK) / 2; // 250

export interface DrawView {
  ready: boolean;
  skin: TetrisSkin;
  theme: TetrisTheme;
  fontFamily: string;
  board: Board;
  current: Piece;
  ghostY: number | null; // null → no ghost
  queue: Piece[];
  held: Piece | null;
  previewLeft: number;
  lines: number;
  energy: number;
  slowMs: number;
  choosing: boolean;
  canUndo: boolean;
}

interface Surface {
  bg: string;
  grid: string;
  ink: string; // panel values
  well: string; // playfield tint
  wall: string; // well border
}

const NEON_INK = "#e6e9ff";

function surfaceFor(skin: TetrisSkin, theme: TetrisTheme): Surface {
  switch (skin) {
    case "neon":
      return {
        bg: "#000",
        grid: "#14141f",
        ink: NEON_INK,
        well: "#0a0a12",
        wall: "#00f5ff",
      };
    case "pastel":
      return {
        bg: "#fdf6fb",
        grid: "#f0e4ee",
        ink: "#22252e",
        well: "#f3e6f0",
        wall: "#c58bb8",
      };
    case "pixel":
      return {
        bg: "#101820",
        grid: "#1c2733",
        ink: "#e0e0e0",
        well: "#16202b",
        wall: "#5d7a94",
      };
    case "retro":
      return theme === "light"
        ? {
            bg: "#ffffff",
            grid: "#e3e6ee",
            ink: "#22252e",
            well: "#f1f3f8",
            wall: "#8a90a3",
          }
        : {
            bg: "#1a1a25",
            grid: "#22222e",
            ink: "#e0e0e0",
            well: "#20202d",
            wall: "#6b6b86",
          };
  }
}

function roundedRectPath(
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

type BlockDrawer = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  s: number,
  color: string,
) => void;

const BLOCK_DRAWERS: Record<TetrisSkin, BlockDrawer> = {
  retro(ctx, px, py, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px, py, s, 4);
  },
  neon(ctx, px, py, s, color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(px + 3, py + 3, s - 6, 2);
  },
  pastel(ctx, px, py, s, color) {
    const r = Math.max(2, s * 0.3);
    ctx.fillStyle = color;
    roundedRectPath(ctx, px, py, s, s, r);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundedRectPath(
      ctx,
      px + s * 0.18,
      py + s * 0.14,
      s * 0.64,
      s * 0.16,
      s * 0.08,
    );
    ctx.fill();
  },
  pixel(ctx, px, py, s, color) {
    const u = Math.max(2, Math.round(s / 6)); // texture "pixel" size
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
    // checker texture
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i * u < s; i++)
      for (let j = 0; j * u < s; j++)
        if ((i + j) % 2)
          ctx.fillRect(
            px + i * u,
            py + j * u,
            Math.min(u, s - i * u),
            Math.min(u, s - j * u),
          );
    // bevel
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(px, py, s, u);
    ctx.fillRect(px, py, u, s);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(px, py + s - u, s, u);
    ctx.fillRect(px + s - u, py, u, s);
  },
};

/** Draws one cell at grid position (cx, cy) of a grid with origin (ox, oy). */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
  ox: number,
  oy: number,
  cx: number,
  cy: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  BLOCK_DRAWERS[skin](
    ctx,
    ox + cx * size + 1,
    oy + cy * size + 1,
    size - 2,
    SKIN_COLORS[skin][colorIndex],
  );
  ctx.globalAlpha = 1;
}

/** Draws a piece centered in a 4×4-cell slot whose top-left is (px, py). */
function drawPieceInSlot(
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
  shape: Shape,
  size: number,
  px: number,
  py: number,
) {
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(ctx, skin, px, py, offX + c, offY + r, shape[r][c], size);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  view: DrawView,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    color?: string;
    alpha?: number;
    align?: CanvasTextAlign;
  } = {},
) {
  ctx.font = `${opts.size ?? 10}px ${view.fontFamily}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? surfaceFor(view.skin, view.theme).ink;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

const label = (
  ctx: CanvasRenderingContext2D,
  view: DrawView,
  text: string,
  x: number,
  y: number,
) => drawText(ctx, view, text, x, y, { size: 10, alpha: 0.6 });

function drawBoard(ctx: CanvasRenderingContext2D, view: DrawView, s: Surface) {
  const { skin, board, current } = view;
  const boardW = COLS * BLOCK;
  const boardH = ROWS * BLOCK;

  // Playfield tint so the well reads against the panels.
  ctx.fillStyle = s.well;
  ctx.fillRect(BOARD_X, 0, boardW, boardH);

  ctx.strokeStyle = s.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(BOARD_X + c * BLOCK, 0);
    ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(BOARD_X, r * BLOCK);
    ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, skin, BOARD_X, 0, c, r, board[r][c], BLOCK);

  if (view.ghostY !== null) {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          skin,
          BOARD_X,
          0,
          current.x + c,
          view.ghostY + r,
          current.shape[r][c],
          BLOCK,
          0.2,
        );
  }

  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(
        ctx,
        skin,
        BOARD_X,
        0,
        current.x + c,
        current.y + r,
        current.shape[r][c],
        BLOCK,
      );

  // Walls: left, right and floor of the well, just outside the cells.
  ctx.strokeStyle = s.wall;
  ctx.lineWidth = 2;
  if (skin === "neon") {
    ctx.shadowColor = s.wall;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.moveTo(BOARD_X - 1, 0);
  ctx.lineTo(BOARD_X - 1, boardH + 1);
  ctx.lineTo(BOARD_X + boardW + 1, boardH + 1);
  ctx.lineTo(BOARD_X + boardW + 1, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawLeftPanel(ctx: CanvasRenderingContext2D, view: DrawView) {
  if (!view.held) return;
  const x = 25;
  label(ctx, view, "HOLD", x, 34);
  drawPieceInSlot(ctx, view.skin, view.held.shape, BLOCK, x, 44);
}

function drawRightPanel(
  ctx: CanvasRenderingContext2D,
  view: DrawView,
  s: Surface,
) {
  const x = BOARD_X + COLS * BLOCK + 25; // 575
  label(ctx, view, "NEXT", x, 34);
  drawPieceInSlot(ctx, view.skin, view.queue[0].shape, BLOCK, x, 44);

  label(ctx, view, "LINES", x, 180);
  drawText(ctx, view, String(view.lines), x, 206, { size: 16 });

  const full = view.energy >= ENERGY_MAX;
  label(ctx, view, "ENERGY", x, 242);
  ctx.strokeStyle = s.ink;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, 252.5, 200, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = SKIN_COLORS.neon[full ? 4 : 1];
  ctx.fillRect(x + 1, 253, (198 * view.energy) / ENERGY_MAX, 13);

  const status =
    view.slowMs > 0
      ? `SLOW ${Math.ceil(view.slowMs / 1000)}s`
      : full
        ? "PRESS E"
        : "";
  if (status) drawText(ctx, view, status, x, 288, { size: 10 });

  if (view.previewLeft > 0) {
    label(ctx, view, "PREVIEW", x, 324);
    for (let i = 0; i < PREVIEW_COUNT; i++)
      drawPieceInSlot(ctx, view.skin, view.queue[i].shape, 15, x, 334 + i * 52);
  }
}

const ABILITY_OPTIONS = [
  "1 PREVIEW 5",
  "2 SWAP PIECE",
  "3 SLOW 10s",
  "4 UNDO",
  "5 HOLD PIECE",
];

function drawAbilityMenu(
  ctx: CanvasRenderingContext2D,
  view: DrawView,
  s: Surface,
) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);

  const w = 280;
  const h = 300;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  ctx.fillStyle = s.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = s.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  drawText(ctx, view, "ABILITY", W / 2, y + 40, { size: 14, align: "center" });
  ABILITY_OPTIONS.forEach((text, i) => {
    const disabled =
      (i === 3 && !view.canUndo) || (i === 4 && view.held !== null);
    drawText(ctx, view, text, x + 36, y + 90 + i * 34, {
      size: 12,
      alpha: disabled ? 0.3 : 1,
    });
  });
  drawText(ctx, view, "ESC CANCEL", W / 2, y + h - 20, {
    size: 10,
    alpha: 0.6,
    align: "center",
  });
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: DrawView) {
  const s = surfaceFor(view.skin, view.theme);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);

  drawBoard(ctx, view, s);
  drawLeftPanel(ctx, view);
  drawRightPanel(ctx, view, s);
  if (view.ready) {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = s.bg;
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, H);
    ctx.globalAlpha = 1;
    drawText(ctx, view, "PRESS SPACE TO START", W / 2, H / 2, {
      size: 12,
      align: "center",
    });
  }
  if (view.choosing) drawAbilityMenu(ctx, view, s);
}
