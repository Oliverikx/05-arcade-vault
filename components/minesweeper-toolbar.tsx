"use client";

import { useEffect, useState } from "react";
import type { MinesweeperSkin } from "@/lib/games/minesweeper/engine";

export const MINESWEEPER_SOUND_KEY = "av_minesweeper_sound";
export const MINESWEEPER_SKIN_KEY = "av_minesweeper_skin";
const SKINS: MinesweeperSkin[] = ["neon", "retro", "classic"];
const DEFAULT_SKIN: MinesweeperSkin = "neon";

function readSkin(): MinesweeperSkin {
  try {
    const raw = localStorage.getItem(MINESWEEPER_SKIN_KEY);
    return SKINS.find((s) => s === raw) ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Skin persisted per browser; read after mount to keep SSR markup stable. */
export function useMinesweeperSkin() {
  const [skin, setSkin] = useState<MinesweeperSkin>(DEFAULT_SKIN);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setSkin(readSkin());
  }, []);

  const update = (next: MinesweeperSkin) => {
    setSkin(next);
    try {
      localStorage.setItem(MINESWEEPER_SKIN_KEY, next);
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [skin, update] as const;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MINESWEEPER_SOUND_KEY) === "off";
  } catch {
    return false;
  }
}

/** Mute choice persisted per browser; read after mount to keep SSR markup stable. */
export function useMinesweeperSound() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setMuted(readMuted());
  }, []);

  const update = (next: boolean) => {
    setMuted(next);
    try {
      localStorage.setItem(MINESWEEPER_SOUND_KEY, next ? "off" : "on");
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [muted, update] as const;
}

interface Props {
  skin: MinesweeperSkin;
  onSkinChange(next: MinesweeperSkin): void;
  muted: boolean;
  onChange(next: boolean): void;
  hintsLeft: number;
  canHint: boolean; // playing, not paused, score >= 100, hintsLeft > 0
  onHint(): void;
}

export function MinesweeperToolbar({
  skin,
  onSkinChange,
  muted,
  onChange,
  hintsLeft,
  canHint,
  onHint,
}: Props) {
  return (
    <div className="tetris-toolbar ms-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={skin}
          onChange={(e) => {
            onSkinChange(e.target.value as MinesweeperSkin);
            e.currentTarget.blur();
          }}
        >
          {SKINS.map((s) => (
            <option key={s} value={s}>
              {s.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <div className="tt-toggle" role="group" aria-label="Hint">
        <button
          type="button"
          disabled={!canHint}
          onClick={(e) => {
            onHint();
            e.currentTarget.blur();
          }}
        >
          {`HINT (${hintsLeft})`}
        </button>
      </div>
      <div className="tt-toggle" role="group" aria-label="Sound">
        <button
          type="button"
          className={muted ? "" : "active"}
          aria-pressed={!muted}
          onClick={(e) => {
            onChange(!muted);
            e.currentTarget.blur();
          }}
        >
          {muted ? "SOUND: OFF" : "SOUND: ON"}
        </button>
      </div>
    </div>
  );
}
