"use client";

import { useEffect, useState } from "react";
import type { TetrisSkin, TetrisTheme } from "@/lib/games/tetris/engine";

export interface TetrisAppearance {
  skin: TetrisSkin;
  theme: TetrisTheme;
}

const SKINS: TetrisSkin[] = ["retro", "neon", "pastel", "pixel"];
const THEMES: TetrisTheme[] = ["light", "dark"];
const SKIN_KEY = "av_tetris_skin";
const THEME_KEY = "av_tetris_theme";
const DEFAULT_APPEARANCE: TetrisAppearance = { skin: "neon", theme: "dark" };

function readStored(): TetrisAppearance {
  try {
    const skin = localStorage.getItem(SKIN_KEY);
    const theme = localStorage.getItem(THEME_KEY);
    return {
      skin: SKINS.find((s) => s === skin) ?? DEFAULT_APPEARANCE.skin,
      theme: THEMES.find((t) => t === theme) ?? DEFAULT_APPEARANCE.theme,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Skin/theme persisted per browser; read after mount to keep SSR markup stable. */
export function useTetrisAppearance() {
  const [appearance, setAppearance] =
    useState<TetrisAppearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setAppearance(readStored());
  }, []);

  const update = (next: TetrisAppearance) => {
    setAppearance(next);
    try {
      localStorage.setItem(SKIN_KEY, next.skin);
      localStorage.setItem(THEME_KEY, next.theme);
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [appearance, update] as const;
}

interface Props {
  appearance: TetrisAppearance;
  onChange(next: TetrisAppearance): void;
}

export function TetrisToolbar({ appearance, onChange }: Props) {
  return (
    <div className="tetris-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={appearance.skin}
          onChange={(e) => {
            onChange({ ...appearance, skin: e.target.value as TetrisSkin });
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
      <div className="tt-toggle" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            className={appearance.theme === t ? "active" : ""}
            aria-pressed={appearance.theme === t}
            onClick={(e) => {
              onChange({ ...appearance, theme: t });
              e.currentTarget.blur();
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
