export interface GameCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
  /** Tetris only: ability menu opened/closed. Fires only on change. */
  onAbilityMenu?(open: boolean): void;
  /** Minesweeper only: hints left on the current board and whether one can be used now. Fires only on change. */
  onHints?(left: number, active: boolean): void;
}

export interface GameEngine {
  setPaused(paused: boolean): void; // freezes update, keeps drawing last frame
  end(): void; // force gameover → onGameOver(score)
  reset(): void; // new run, back to "ready"
  destroy(): void; // cancel rAF, remove listeners
}
