export interface GameCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
}

export interface GameEngine {
  setPaused(paused: boolean): void; // freezes update, keeps drawing last frame
  end(): void; // force gameover → onGameOver(score)
  reset(): void; // new run, back to "ready"
  destroy(): void; // cancel rAF, remove listeners
}
