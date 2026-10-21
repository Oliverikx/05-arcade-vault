// Tetris pieces, rules and constants — ported from resources/started-games/03-tetris/game.js

export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel" | "classic";
export type TetrisTheme = "dark" | "light";

export type Shape = number[][];
export type Board = number[][];

export interface Piece {
  type: number; // 1..8 = I, O, T, S, Z, J, L, Screw (also the cell value)
  shape: Shape;
  x: number;
  y: number;
}

export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

export const LINE_SCORES = [0, 100, 300, 500, 800];
export const ENERGY_MAX = 100;
export const ENERGY_PER_LINE = 25;
export const PREVIEW_PIECES = 10; // spawns the 5-piece preview stays active
export const PREVIEW_COUNT = 5;
export const SLOW_MS = 10000;
export const SLOW_FACTOR = 2;
export const KICKS = [0, -1, 1, -2, 2];
export const MAX_SCORE = 10_000_000; // DB CHECK

// index = piece type; index 0 is unused (empty cell)
const SHAPES: Shape[] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // Screw
];
export const PIECE_TYPES = SHAPES.length - 1;

// index = piece type (0 unused). `neon` follows the platform palette.
export const SKIN_COLORS: Record<TetrisSkin, string[]> = {
  retro: [
    "",
    "#4dd0e1",
    "#ffd54f",
    "#ba68c8",
    "#81c784",
    "#e57373",
    "#64b5f6",
    "#ffb74d",
    "#b0bec5",
  ],
  neon: [
    "",
    "#00f5ff",
    "#f5ff00",
    "#aa00ff",
    "#00ff88",
    "#ff006e",
    "#1f51ff",
    "#ff7700",
    "#e6e9ff",
  ],
  pastel: [
    "",
    "#a8e6ef",
    "#fff1b8",
    "#d9b8f0",
    "#b8e6c1",
    "#f5b8b8",
    "#b8d4f5",
    "#fbd3a8",
    "#d5dde2",
  ],
  pixel: [
    "",
    "#29b6c9",
    "#e6b422",
    "#9c3fb0",
    "#4caf50",
    "#d84343",
    "#3f7fd6",
    "#e8821e",
    "#8a9ba5",
  ],
  classic: [
    "",
    "#00f0f0",
    "#f0f000",
    "#a000f0",
    "#00f000",
    "#f00000",
    "#0000f0",
    "#f0a000",
    "#808080",
  ],
};

export function intervalFor(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

export function makePiece(type: number): Piece {
  const shape = SHAPES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function randomType(): number {
  return Math.floor(Math.random() * PIECE_TYPES) + 1;
}

export function shapeOf(type: number): Shape {
  return SHAPES[type].map((row) => [...row]);
}

export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}
