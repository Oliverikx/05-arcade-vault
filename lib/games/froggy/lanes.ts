// Froggy lane data and entity-position helpers — framework-free.

export const CELL = 40;
export const COLS = 16;
export const ROWS = 12;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 480

export type LaneKind = "car" | "truck" | "bus" | "log";

export interface Lane {
  row: number; // 1..4 river, 6..10 road
  kind: LaneKind;
  dir: 1 | -1; // 1 = moves right
  speed: number; // px/s at level 1
  w: number; // entity width in cells
  gap: number; // empty cells between entities
}

export const LANES: Lane[] = [
  { row: 1, kind: "log", dir: 1, speed: 40, w: 3, gap: 3 },
  { row: 2, kind: "log", dir: -1, speed: 70, w: 2, gap: 3 },
  { row: 3, kind: "log", dir: 1, speed: 30, w: 4, gap: 3 },
  { row: 4, kind: "log", dir: -1, speed: 55, w: 3, gap: 3 },
  { row: 6, kind: "car", dir: -1, speed: 60, w: 1, gap: 4 },
  { row: 7, kind: "car", dir: 1, speed: 90, w: 1, gap: 5 },
  { row: 8, kind: "truck", dir: -1, speed: 50, w: 2, gap: 5 },
  { row: 9, kind: "car", dir: 1, speed: 120, w: 1, gap: 6 },
  { row: 10, kind: "bus", dir: -1, speed: 75, w: 3, gap: 5 },
];

/** Distance between entity starts, in px. */
export const periodOf = (lane: Lane) => (lane.w + lane.gap) * CELL;
/** Number of entities in the wrapping pattern. */
export const countOf = (lane: Lane) =>
  Math.ceil((W + lane.w * CELL) / periodOf(lane)) + 1;
/** Wrap modulus of the pattern, in px. */
export const modulusOf = (lane: Lane) => countOf(lane) * periodOf(lane);

/** Speed multiplier for a level, capped at 2.0. */
export const speedMult = (level: number) =>
  Math.min(2, 1 + 0.1 * (level - 1));

/**
 * Left x of every entity of a lane. `phase` is the distance the pattern has
 * travelled (signed by direction) — accumulated by the engine so a level-up
 * speed change never makes entities jump.
 */
export function entityXs(lane: Lane, phase: number): number[] {
  const m = modulusOf(lane);
  const p = periodOf(lane);
  const n = countOf(lane);
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const raw = lane.row * 53 + i * p + phase;
    xs.push((((raw % m) + m) % m) - lane.w * CELL);
  }
  return xs;
}
