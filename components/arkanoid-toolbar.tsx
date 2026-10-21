"use client";

import { useEffect, useState } from "react";
import type { ArkanoidSkin } from "@/lib/games/arkanoid/engine";

const MUTED_KEY = "av_arkanoid_muted";
const SKIN_KEY = "av_arkanoid_skin";
const SKINS: ArkanoidSkin[] = ["neon", "retro", "classic"];

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

function readSkin(): ArkanoidSkin {
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    return SKINS.includes(raw as ArkanoidSkin) ? (raw as ArkanoidSkin) : "neon";
  } catch {
    return "neon";
  }
}

/** Skin choice persisted per browser; read after mount to keep SSR markup stable. */
export function useArkanoidSkin() {
  const [skin, setSkin] = useState<ArkanoidSkin>("neon");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setSkin(readSkin());
  }, []);

  const update = (next: ArkanoidSkin) => {
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
  muted: boolean;
  onChange(next: boolean): void;
  skin: ArkanoidSkin;
  onSkinChange(next: ArkanoidSkin): void;
}

export function ArkanoidToolbar({
  muted,
  onChange,
  skin,
  onSkinChange,
}: Props) {
  return (
    <div className="tetris-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={skin}
          onChange={(e) => {
            onSkinChange(e.target.value as ArkanoidSkin);
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
