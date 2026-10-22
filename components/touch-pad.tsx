"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PadButton, PadDir, TouchLayout } from "@/lib/games/registry";

const REPEAT_DELAY_MS = 170;
const REPEAT_INTERVAL_MS = 50;

// Same triangle rotated per direction, so every arrow has identical size.
const DIRS: { dir: PadDir; rotate: number; cls: string }[] = [
  { dir: "ArrowUp", rotate: 0, cls: "up" },
  { dir: "ArrowLeft", rotate: -90, cls: "left" },
  { dir: "ArrowRight", rotate: 90, cls: "right" },
  { dir: "ArrowDown", rotate: 180, cls: "down" },
];

const DIR_NAMES: Record<PadDir, string> = {
  ArrowUp: "Up",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowDown: "Down",
};

// `key` value that matches each dispatched `code`.
function keyFor(code: string): string {
  if (code === "Space") return " ";
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  return code;
}

function fire(type: "keydown" | "keyup", code: string, repeat = false) {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: keyFor(code),
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

interface Held {
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

export function TouchPad({
  layout,
  abilityMenu,
  disabled,
}: {
  layout: TouchLayout;
  abilityMenu: boolean;
  disabled: boolean;
}) {
  const heldRef = useRef(new Map<string, Held>());

  const press = useCallback(
    (code: string, repeats: boolean) => {
      if (disabled || heldRef.current.has(code)) return;
      const held: Held = {};
      heldRef.current.set(code, held);
      fire("keydown", code);
      if (repeats) {
        held.delay = setTimeout(() => {
          held.interval = setInterval(
            () => fire("keydown", code, true),
            REPEAT_INTERVAL_MS,
          );
        }, REPEAT_DELAY_MS);
      }
    },
    [disabled],
  );

  const release = useCallback((code: string) => {
    const held = heldRef.current.get(code);
    if (!held) return;
    clearTimeout(held.delay);
    clearInterval(held.interval);
    heldRef.current.delete(code);
    fire("keyup", code);
  }, []);

  // Release every held key on pause / game over / ability swap / unmount.
  useEffect(() => {
    const heldKeys = heldRef.current;
    return () => {
      for (const code of [...heldKeys.keys()]) {
        const held = heldKeys.get(code);
        clearTimeout(held?.delay);
        clearInterval(held?.interval);
        heldKeys.delete(code);
        fire("keyup", code);
      }
    };
  }, [disabled, abilityMenu]);

  const bind = (code: string, repeats: boolean) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      press(code, repeats);
    },
    onPointerUp: () => release(code),
    onPointerCancel: () => release(code),
    onLostPointerCapture: () => release(code),
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  });

  const buttons: PadButton[] =
    abilityMenu && layout.abilityButtons
      ? layout.abilityButtons
      : layout.buttons;

  return (
    <div className="touch-pad" aria-label="Touch controls">
      <div className="tp-dpad">
        {DIRS.filter(({ dir }) => layout.dpad.includes(dir)).map(
          ({ dir, rotate, cls }) => (
            <button
              key={dir}
              type="button"
              className={`tp-key tp-dir ${cls}`}
              aria-label={DIR_NAMES[dir]}
              {...bind(dir, !!layout.repeat?.includes(dir))}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
                style={{ transform: `rotate(${rotate}deg)` }}
              >
                <path d="M12 4 L21 19 H3 Z" fill="currentColor" />
              </svg>
            </button>
          ),
        )}
        <span className="tp-hub" aria-hidden="true" />
      </div>

      {buttons.length > 0 && (
        <div className="tp-actions">
          {buttons.map((b, i) => (
            <button
              key={`${abilityMenu}-${b.code}`}
              type="button"
              className={`tp-key tp-act a${Math.min(i, 2)}`}
              {...bind(b.code, false)}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
