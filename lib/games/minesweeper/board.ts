// Minesweeper board logic — pure functions, no DOM.

export interface BoardSpec {
  cols: number;
  rows: number;
  mines: number;
}

export interface Cell {
  mine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
}

export function boardForLevel(level: number): BoardSpec {
  if (level <= 1) return { cols: 10, rows: 8, mines: 10 };
  if (level === 2) return { cols: 14, rows: 10, mines: 24 };
  if (level === 3) return { cols: 18, rows: 13, mines: 48 };
  return {
    cols: 20,
    rows: 14,
    mines: Math.min(90, 60 + 5 * (level - 4)),
  };
}

export function createCells(spec: BoardSpec): Cell[] {
  return Array.from({ length: spec.cols * spec.rows }, () => ({
    mine: false,
    adj: 0,
    revealed: false,
    flagged: false,
  }));
}

export function neighbors(spec: BoardSpec, index: number): number[] {
  const c = index % spec.cols;
  const r = Math.floor(index / spec.cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= spec.cols || nr < 0 || nr >= spec.rows) continue;
      out.push(nr * spec.cols + nc);
    }
  }
  return out;
}

/** Places mines everywhere except `safeIndex` and its neighbors, then counts adjacency. */
export function placeMines(
  cells: Cell[],
  spec: BoardSpec,
  safeIndex: number,
  rng: () => number,
): void {
  const blocked = new Set([safeIndex, ...neighbors(spec, safeIndex)]);
  const pool: number[] = [];
  for (let i = 0; i < cells.length; i++) if (!blocked.has(i)) pool.push(i);
  // Partial Fisher-Yates: the first `mines` entries are the mine cells.
  const count = Math.min(spec.mines, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    cells[pool[i]].mine = true;
  }
  for (let i = 0; i < cells.length; i++) {
    cells[i].adj = neighbors(spec, i).filter((n) => cells[n].mine).length;
  }
}

/** Reveals a hidden, unflagged cell; flood-fills zero cells iteratively. */
export function reveal(
  cells: Cell[],
  spec: BoardSpec,
  index: number,
): { opened: number; hitMine: boolean } {
  const start = cells[index];
  if (start.revealed || start.flagged) return { opened: 0, hitMine: false };
  if (start.mine) {
    start.revealed = true;
    return { opened: 0, hitMine: true };
  }
  let opened = 0;
  const stack = [index];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const cell = cells[i];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    opened++;
    if (cell.adj === 0) {
      for (const n of neighbors(spec, i)) {
        if (!cells[n].revealed && !cells[n].flagged) stack.push(n);
      }
    }
  }
  return { opened, hitMine: false };
}

/** Chord on a revealed number whose adjacent flags match it. */
export function chord(
  cells: Cell[],
  spec: BoardSpec,
  index: number,
): { opened: number; hitMine: boolean } {
  const cell = cells[index];
  if (!cell.revealed || cell.adj === 0) return { opened: 0, hitMine: false };
  const near = neighbors(spec, index);
  if (near.filter((n) => cells[n].flagged).length !== cell.adj) {
    return { opened: 0, hitMine: false };
  }
  let opened = 0;
  let hitMine = false;
  for (const n of near) {
    const res = reveal(cells, spec, n);
    opened += res.opened;
    if (res.hitMine) hitMine = true;
  }
  return { opened, hitMine };
}

/** Safe hint target: a hidden non-mine cell, frontier cells (next to a revealed number) first. */
export function pickHintCell(
  cells: Cell[],
  spec: BoardSpec,
  rng: () => number,
): number | null {
  const safe: number[] = [];
  const frontier: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.revealed || cell.mine) continue;
    safe.push(i);
    if (neighbors(spec, i).some((n) => cells[n].revealed && cells[n].adj > 0)) {
      frontier.push(i);
    }
  }
  const pool = frontier.length > 0 ? frontier : safe;
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}
