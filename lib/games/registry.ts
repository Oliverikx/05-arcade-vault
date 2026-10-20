import { createAsteroidsGame } from "@/lib/games/asteroids/engine";
import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { createTetrisGame } from "@/lib/games/tetris/engine";

export interface EngineEntry {
  create(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameEngine;
  width: number;
  height: number;
  /** Initial lives shown in the HUD; null → no lives (HUD shows "—"). */
  lives: number | null;
  keyboardRequired: boolean;
}

const ENGINES: Record<string, EngineEntry> = {
  asteroids: {
    create: createAsteroidsGame,
    width: 800,
    height: 600,
    lives: 3,
    keyboardRequired: true,
  },
  tetris: {
    create: createTetrisGame,
    width: 800,
    height: 600,
    lives: null,
    keyboardRequired: true,
  },
};

export function getEngine(id: string): EngineEntry | undefined {
  return ENGINES[id];
}
