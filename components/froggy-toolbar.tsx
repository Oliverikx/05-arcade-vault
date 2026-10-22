"use client";

import { useEffect, useState } from "react";
import type { FroggySkin } from "@/lib/games/froggy/engine";

export const FROGGY_MUTE_KEY = "av_froggy_muted";
export const FROGGY_SKIN_KEY = "av_froggy_skin";
const SKINS: FroggySkin[] = ["neon", "retro", "classic"];
const DEFAULT_SKIN: FroggySkin = "neon";

function readSkin(): FroggySkin {
  try {
    const raw = localStorage.getItem(FROGGY_SKIN_KEY);
    return SKINS.find((s) => s === raw) ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Skin persisted per browser; read after mount to keep SSR markup stable. */
export function useFroggySkin() {
  const [skin, setSkin] = useState<FroggySkin>(DEFAULT_SKIN);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setSkin(readSkin());
  }, []);

  const update = (next: FroggySkin) => {
    setSkin(next);
    try {
      localStorage.setItem(FROGGY_SKIN_KEY, next);
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [skin, update] as const;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(FROGGY_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mute choice persisted per browser; read after mount to keep SSR markup stable. */
export function useFroggyMuted() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setMuted(readMuted());
  }, []);

  const update = (next: boolean) => {
    setMuted(next);
    try {
      localStorage.setItem(FROGGY_MUTE_KEY, next ? "1" : "0");
    } catch {
      // private mode: keep the choice for this visit only
    }
  };

  return [muted, update] as const;
}

interface Props {
  skin: FroggySkin;
  onSkinChange(next: FroggySkin): void;
  muted?: boolean;
  onMutedChange?(next: boolean): void;
}

export function FroggyToolbar({
  skin,
  onSkinChange,
  muted,
  onMutedChange,
}: Props) {
  return (
    <div className="tetris-toolbar">
      <label className="tt-field">
        <span>SKIN</span>
        <select
          value={skin}
          onChange={(e) => {
            onSkinChange(e.target.value as FroggySkin);
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
      {muted !== undefined && onMutedChange && (
        <div className="tt-toggle" role="group" aria-label="Sound">
          {[false, true].map((m) => (
            <button
              key={String(m)}
              type="button"
              className={muted === m ? "active" : ""}
              aria-pressed={muted === m}
              onClick={(e) => {
                onMutedChange(m);
                e.currentTarget.blur();
              }}
            >
              {m ? "SOUND OFF" : "SOUND ON"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
