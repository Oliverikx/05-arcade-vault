"use client";

import { useEffect, useState } from "react";
import type { SnakeSkin } from "@/lib/games/snake/engine";

const SKINS: SnakeSkin[] = ["neon", "retro", "classic"];
const SKIN_KEY = "av_snake_skin";
const DEFAULT_SKIN: SnakeSkin = "neon";

function readStored(): SnakeSkin {
  try {
    const skin = localStorage.getItem(SKIN_KEY);
    return SKINS.find((s) => s === skin) ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Skin persisted per browser; read after mount to keep SSR markup stable. */
export function useSnakeSkin() {
  const [skin, setSkin] = useState<SnakeSkin>(DEFAULT_SKIN);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setSkin(readStored());
  }, []);

  const update = (next: SnakeSkin) => {
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
  skin: SnakeSkin;
  onChange(next: SnakeSkin): void;
}

export function SnakeToolbar({ skin, onChange }: Props) {
  return (
    <div className="tetris-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={skin}
          onChange={(e) => {
            onChange(e.target.value as SnakeSkin);
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
