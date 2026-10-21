"use client";

import { useEffect, useState } from "react";
import type { AsteroidsSkin } from "@/lib/games/asteroids/engine";

const SKINS: AsteroidsSkin[] = ["neon", "retro", "classic"];
const SKIN_KEY = "av_asteroids_skin";
const DEFAULT_SKIN: AsteroidsSkin = "neon";

function readStored(): AsteroidsSkin {
  try {
    const skin = localStorage.getItem(SKIN_KEY);
    return SKINS.find((s) => s === skin) ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Skin persisted per browser; read after mount to keep SSR markup stable. */
export function useAsteroidsSkin() {
  const [skin, setSkin] = useState<AsteroidsSkin>(DEFAULT_SKIN);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setSkin(readStored());
  }, []);

  const update = (next: AsteroidsSkin) => {
    setSkin(next);
    try {
      localStorage.setItem(SKIN_KEY, next);
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [skin, update] as const;
}

interface Props {
  skin: AsteroidsSkin;
  onChange(next: AsteroidsSkin): void;
}

export function AsteroidsToolbar({ skin, onChange }: Props) {
  return (
    <div className="tetris-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={skin}
          onChange={(e) => {
            onChange(e.target.value as AsteroidsSkin);
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
    </div>
  );
}
