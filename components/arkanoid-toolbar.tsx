"use client";

import { useEffect, useState } from "react";

const MUTED_KEY = "av_arkanoid_muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mute choice persisted per browser; read after mount to keep SSR markup stable. */
export function useArkanoidMuted() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setMuted(readMuted());
  }, []);

  const update = (next: boolean) => {
    setMuted(next);
    try {
      localStorage.setItem(MUTED_KEY, next ? "1" : "0");
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [muted, update] as const;
}

interface Props {
  muted: boolean;
  onChange(next: boolean): void;
}

export function ArkanoidToolbar({ muted, onChange }: Props) {
  return (
    <div className="tetris-toolbar">
      <div className="tt-toggle" role="group" aria-label="Sound">
        {[false, true].map((m) => (
          <button
            key={String(m)}
            type="button"
            className={muted === m ? "active" : ""}
            aria-pressed={muted === m}
            onClick={(e) => {
              onChange(m);
              e.currentTarget.blur();
            }}
          >
            {m ? "SOUND OFF" : "SOUND ON"}
          </button>
        ))}
      </div>
    </div>
  );
}
