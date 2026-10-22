import { createArkanoidGame } from "@/lib/games/arkanoid/engine";
import { createAsteroidsGame } from "@/lib/games/asteroids/engine";
import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import { createSnakeGame } from "@/lib/games/snake/engine";
import { createTetrisGame } from "@/lib/games/tetris/engine";

export type PadDir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export interface PadButton {
  label: string; // shown on the button, e.g. "FIRE"
  code: string; // KeyboardEvent.code dispatched, e.g. "Space"
}

export interface TouchLayout {
  dpad: PadDir[]; // enabled directions; others render dimmed
  buttons: PadButton[]; // right cluster, 0..3
  repeat?: PadDir[]; // auto-repeat while held
  abilityButtons?: PadButton[]; // replace `buttons` while onAbilityMenu(true)
}

export interface EngineEntry {
  create(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameEngine;
  width: number;
  height: number;
  /** Initial lives shown in the HUD; null → no lives (HUD shows "—"). */
  lives: number | null;
  touch: TouchLayout;
}

const ENGINES: Record<string, EngineEntry> = {
  arkanoid: {
    create: createArkanoidGame,
    width: 640,
    height: 480,
    lives: 3,
    touch: {
      dpad: ["ArrowLeft", "ArrowRight"],
      buttons: [{ label: "LAUNCH", code: "Space" }],
    },
  },
  asteroids: {
    create: createAsteroidsGame,
    width: 800,
    height: 600,
    lives: 3,
    touch: {
      dpad: ["ArrowLeft", "ArrowRight", "ArrowUp"],
      buttons: [{ label: "FIRE", code: "Space" }],
    },
  },
  snake: {
    create: createSnakeGame,
    width: 640,
    height: 480,
    lives: 3,
    touch: {
      dpad: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
      buttons: [],
    },
  },
  tetris: {
    create: createTetrisGame,
    width: 800,
    height: 600,
    lives: null,
    touch: {
      dpad: ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"],
      buttons: [
        { label: "DROP", code: "Space" },
        { label: "ABILITY", code: "KeyE" },
      ],
      repeat: ["ArrowLeft", "ArrowRight", "ArrowDown"],
      abilityButtons: [
        { label: "1", code: "Digit1" },
        { label: "2", code: "Digit2" },
        { label: "3", code: "Digit3" },
        { label: "4", code: "Digit4" },
        { label: "5", code: "Digit5" },
        { label: "BACK", code: "Escape" },
      ],
    },
  },
};

export function getEngine(id: string): EngineEntry | undefined {
  return ENGINES[id];
}
