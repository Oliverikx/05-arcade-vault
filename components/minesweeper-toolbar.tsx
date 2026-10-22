"use client";

import { useEffect, useState } from "react";

export const MINESWEEPER_SOUND_KEY = "av_minesweeper_sound";

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
  muted: boolean;
  onChange(next: boolean): void;
  hintsLeft: number;
  canHint: boolean; // playing, not paused, score >= 100, hintsLeft > 0
  onHint(): void;
}

export function MinesweeperToolbar({
  muted,
  onChange,
  hintsLeft,
  canHint,
  onHint,
}: Props) {
  return (
    <div className="tetris-toolbar ms-toolbar">
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
