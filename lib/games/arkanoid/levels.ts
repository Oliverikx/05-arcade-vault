// Arkanoid constants, levels and block layout — ported from
// resources/started-games/04-arkanoid/game.js

export const W = 640;
export const H = 480;

export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 100;

export const MAX_BLOCK_W = 64;
export const BLOCKS_TOP = 60;
export const PADDLE_W = 81;
export const PADDLE_H = 14;
export const PADDLE_Y = 450;
export const PADDLE_SPEED = 7;
export const BALL_SIZE = 16;
export const BALL_SPEED = 5;
export const BALL_SPEED_PER_LEVEL = 0.5;
export const LAUNCH_ANGLE = 15; // degrees from vertical, to the right
export const MAX_BOUNCE_ANGLE = 60;
export const START_LIVES = 3;
export const POINTS_PER_BLOCK = 10;
export const WIN_BONUS_PER_LIFE = 100;
export const WIN_STEPS = 90; // YOU WIN banner length (1.5 s)
export const MAX_SCORE = 10_000_000;
export const EXPLOSION_DURATION = 150; // ms
export const EXPLOSION_FRAMES = 4;

export type RowColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export const ROW_COLORS: RowColor[] = [
  "gray",
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];

// 'X' = block, '.' = empty. Color = ROW_COLORS[row % ROW_COLORS.length].
export const LEVELS: string[][] = [
  [
    // L1 — 20 blocks (5 cols)
    "XXXXX",
    "XXXXX",
    "XXXXX",
    "XXXXX",
  ],
  [
    // L2 — 30 blocks, checkerboard (10 cols)
    "X.X.X.X.X.",
    ".X.X.X.X.X",
    "X.X.X.X.X.",
    ".X.X.X.X.X",
    "X.X.X.X.X.",
    ".X.X.X.X.X",
  ],
  [
    // L3 — 40 blocks, V shape (16 cols)
    "XXXX........XXXX",
    ".XXXX......XXXX.",
    "..XXXX....XXXX..",
    "...XXXX..XXXX...",
    "....XXXXXXXX....",
  ],
  [
    // L4 — 50 blocks, 2x2 empty squares (20 cols)
    "XX..XX..XX..XX..XX..",
    "XX..XX..XX..XX..XX..",
    "..XX..XX..XX..XX..XX",
    "..XX..XX..XX..XX..XX",
    "XX..XX..XX..XX..XX..",
  ],
  [
    // L5 — 60 blocks, diagonal stripes (20 cols)
    "XX..XX..XX..XX..XX..",
    ".XX..XX..XX..XX..XX.",
    "..XX..XX..XX..XX..XX",
    "X..XX..XX..XX..XX..X",
    "XX..XX..XX..XX..XX..",
    ".XX..XX..XX..XX..XX.",
  ],
];

export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: RowColor;
  alive: boolean;
  breakElapsed: number | null; // ms into the break animation; null = none
}

export function buildBlocks(levelIndex: number): Block[] {
  const layout = LEVELS[levelIndex];
  const bw = Math.min(MAX_BLOCK_W, W / layout[0].length);
  const bh = bw / 2;
  const offsetX = (W - layout[0].length * bw) / 2;
  const blocks: Block[] = [];
  layout.forEach((rowStr, row) => {
    const color = ROW_COLORS[row % ROW_COLORS.length];
    for (let col = 0; col < rowStr.length; col++) {
      if (rowStr[col] !== "X") continue;
      blocks.push({
        x: offsetX + col * bw,
        y: BLOCKS_TOP + row * bh,
        w: bw,
        h: bh,
        color,
        alive: true,
        breakElapsed: null,
      });
    }
  });
  return blocks;
}

export function levelSpeed(level: number): number {
  return BALL_SPEED + BALL_SPEED_PER_LEVEL * (level - 1);
}
