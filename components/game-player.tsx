"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  ArkanoidToolbar,
  useArkanoidMuted,
} from "@/components/arkanoid-toolbar";
import { GameScreen } from "@/components/game-screen";
import {
  TetrisToolbar,
  useTetrisAppearance,
} from "@/components/tetris-toolbar";
import { useSession } from "@/components/session-provider";
import { saveScore } from "@/app/actions/scores";
import type { Game } from "@/lib/games";
import { getEngine } from "@/lib/games/registry";

// Lives shown for practice (unregistered) games.
const PRACTICE_LIVES = 3;

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const entry = getEngine(game.id);
  const isTetris = game.id === "tetris";
  const isArkanoid = game.id === "arkanoid";
  const [appearance, setAppearance] = useTetrisAppearance();
  const [muted, setMuted] = useArkanoidMuted();
  const initialLives = entry ? entry.lives : PRACTICE_LIVES;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(initialLives ?? 0);
  const [engineLevel, setEngineLevel] = useState(1);
  const [runId, setRunId] = useState(0);
  const [endSignal, setEndSignal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);

  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, startSaving] = useTransition();

  const name = typedName ?? user?.name ?? "GUEST";
  const level = entry ? engineLevel : 1 + Math.floor(score / 2500);

  // Fake score ticker: runs only in the client after mount.
  useEffect(() => {
    if (entry || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [entry, over, paused]);

  // Engine game pause controls: P / Esc toggle, tab hidden auto-pauses.
  useEffect(() => {
    if (!entry || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        e.defaultPrevented ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.repeat
      )
        return;
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [entry, over]);

  const endRun = () => {
    if (entry) setEndSignal((n) => n + 1);
    else setOver(true);
  };

  const restart = () => {
    setScore(0);
    setLives(initialLives ?? 0);
    setEngineLevel(1);
    setRunId((r) => r + 1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(false);
  };

  const save = () => {
    setSaveError(false);
    startSaving(async () => {
      try {
        const result = await saveScore({ gameId: game.id, name, score });
        if (result.ok) setSaved(true);
        else setSaveError(true);
      } catch {
        setSaveError(true);
      }
    });
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Player</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Score</div>
            <div className="v">{score.toLocaleString("en-US")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Lives</div>
            <div className="v">
              {initialLives === null ? "—" : "♥ ".repeat(lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Level</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button className="btn magenta" onClick={endRun}>
            END
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            EXIT
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {entry ? (
            <GameScreen
              gameId={game.id}
              paused={paused}
              runId={runId}
              endSignal={endSignal}
              appearance={isTetris ? appearance : undefined}
              muted={isArkanoid ? muted : undefined}
              onScore={setScore}
              onLives={setLives}
              onLevel={setEngineLevel}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  PAUSED
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PRESS RESUME TO CONTINUE
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SIGNAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>LOAD · 1MB</span>
        </div>
      </div>

      {isTetris && (
        <TetrisToolbar appearance={appearance} onChange={setAppearance} />
      )}

      {isArkanoid && <ArkanoidToolbar muted={muted} onChange={setMuted} />}

      {entry?.keyboardRequired && (
        <div className="keyboard-note">KEYBOARD REQUIRED</div>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{score.toLocaleString("en-US")}</div>
            {!entry ? (
              <div className="practice-note">
                PRACTICE RUN — SCORE NOT RECORDED
              </div>
            ) : !saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setTypedName(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="YOUR INITIALS"
                  />
                  <button
                    className="btn yellow"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? "SAVING..." : "SAVE SCORE"}
                  </button>
                </div>
                {saveError && (
                  <div className="save-error" role="alert">
                    SAVE FAILED — TRY AGAIN
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ SCORE SAVED_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                PLAY AGAIN
              </button>
              <Link href="/games" className="btn magenta">
                BACK TO VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
