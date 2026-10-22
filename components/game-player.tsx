"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArkanoidToolbar,
  useArkanoidMuted,
  useArkanoidSkin,
} from "@/components/arkanoid-toolbar";
import {
  AsteroidsToolbar,
  useAsteroidsSkin,
} from "@/components/asteroids-toolbar";
import {
  FroggyToolbar,
  useFroggyMuted,
  useFroggySkin,
} from "@/components/froggy-toolbar";
import { GameScreen } from "@/components/game-screen";
import {
  MinesweeperToolbar,
  useMinesweeperSkin,
  useMinesweeperSound,
} from "@/components/minesweeper-toolbar";
import { TouchPad } from "@/components/touch-pad";
import { SnakeToolbar, useSnakeSkin } from "@/components/snake-toolbar";
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
  const isAsteroids = game.id === "asteroids";
  const isSnake = game.id === "snake";
  const isFroggy = game.id === "froggy";
  const isMinesweeper = game.id === "minesweeper";
  const [appearance, setAppearance] = useTetrisAppearance();
  const [asteroidsSkin, setAsteroidsSkin] = useAsteroidsSkin();
  const [snakeSkin, setSnakeSkin] = useSnakeSkin();
  const [muted, setMuted] = useArkanoidMuted();
  const [froggyMuted, setFroggyMuted] = useFroggyMuted();
  const [minesweeperMuted, setMinesweeperMuted] = useMinesweeperSound();
  const [minesweeperSkin, setMinesweeperSkin] = useMinesweeperSkin();
  const [froggySkin, setFroggySkin] = useFroggySkin();
  const [arkanoidSkin, setArkanoidSkin] = useArkanoidSkin();
  const initialLives = entry ? entry.lives : PRACTICE_LIVES;
  // Live HUD values: refs + direct DOM writes, so score ticks don't re-render.
  const scoreRef = useRef(0);
  const livesRef = useRef(initialLives ?? 0);
  const levelRef = useRef(1);
  const scoreElRef = useRef<HTMLDivElement>(null);
  const livesElRef = useRef<HTMLDivElement>(null);
  const levelElRef = useRef<HTMLDivElement>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreOver100, setScoreOver100] = useState(false);
  const [runId, setRunId] = useState(0);
  const [endSignal, setEndSignal] = useState(0);
  const [hintSignal, setHintSignal] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [hintsActive, setHintsActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [abilityMenu, setAbilityMenu] = useState(false);

  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, startSaving] = useTransition();

  const name = typedName ?? user?.name ?? "GUEST";

  const paintHud = () => {
    const level = entry
      ? levelRef.current
      : 1 + Math.floor(scoreRef.current / 2500);
    if (scoreElRef.current)
      scoreElRef.current.textContent = scoreRef.current.toLocaleString("en-US");
    if (livesElRef.current)
      livesElRef.current.textContent =
        initialLives === null
          ? "—"
          : "♥ ".repeat(livesRef.current).trim() || "—";
    if (levelElRef.current)
      levelElRef.current.textContent = String(level).padStart(2, "0");
  };

  const onScore = (v: number) => {
    scoreRef.current = v;
    paintHud();
    setScoreOver100(v >= 100);
  };
  const onLives = (v: number) => {
    livesRef.current = v;
    paintHud();
  };
  const onLevel = (v: number) => {
    levelRef.current = v;
    paintHud();
  };

  // Fake score ticker: runs only in the client after mount.
  useEffect(() => {
    if (entry || over || paused) return;
    const t = setInterval(() => {
      scoreRef.current += Math.floor(10 + Math.random() * 90);
      paintHud();
    }, 220);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Lets CSS hide the navbar on touch devices (touch-play) and cheapen page
  // effects (game-play) while a real game is open.
  // Effect cleanup also runs when the cached page is hidden on navigation.
  useEffect(() => {
    if (!entry) return;
    document.body.classList.add("touch-play", "game-play");
    return () => document.body.classList.remove("touch-play", "game-play");
  }, [entry]);

  const endRun = () => {
    if (entry) setEndSignal((n) => n + 1);
    else {
      setFinalScore(scoreRef.current);
      setOver(true);
    }
  };

  const restart = () => {
    scoreRef.current = 0;
    livesRef.current = initialLives ?? 0;
    levelRef.current = 1;
    paintHud();
    setFinalScore(0);
    setScoreOver100(false);
    setRunId((r) => r + 1);
    setPaused(false);
    setOver(false);
    setAbilityMenu(false);
    setHintsLeft(2);
    setHintsActive(false);
    setSaved(false);
    setSaveError(false);
  };

  const save = () => {
    setSaveError(false);
    startSaving(async () => {
      try {
        const result = await saveScore({
          gameId: game.id,
          name,
          score: finalScore,
        });
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
            <div className="v" ref={scoreElRef}>
              0
            </div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Lives</div>
            <div className="v" ref={livesElRef}>
              {initialLives === null
                ? "—"
                : "♥ ".repeat(initialLives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Level</div>
            <div className="v" ref={levelElRef}>
              01
            </div>
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
              hintSignal={hintSignal}
              minesweeperSkin={isMinesweeper ? minesweeperSkin : undefined}
              appearance={isTetris ? appearance : undefined}
              muted={
                isArkanoid
                  ? muted
                  : isFroggy
                    ? froggyMuted
                    : isMinesweeper
                      ? minesweeperMuted
                      : undefined
              }
              arkanoidSkin={isArkanoid ? arkanoidSkin : undefined}
              asteroidsSkin={isAsteroids ? asteroidsSkin : undefined}
              snakeSkin={isSnake ? snakeSkin : undefined}
              froggySkin={isFroggy ? froggySkin : undefined}
              onScore={onScore}
              onLives={onLives}
              onLevel={onLevel}
              onAbilityMenu={setAbilityMenu}
              onHints={(left, active) => {
                setHintsLeft(left);
                setHintsActive(active);
              }}
              onGameOver={(final) => {
                scoreRef.current = final;
                paintHud();
                setFinalScore(final);
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

      {entry && (
        <TouchPad
          layout={entry.touch}
          abilityMenu={abilityMenu}
          disabled={paused || over}
        />
      )}

      {isTetris && (
        <TetrisToolbar appearance={appearance} onChange={setAppearance} />
      )}

      {isArkanoid && (
        <ArkanoidToolbar
          muted={muted}
          onChange={setMuted}
          skin={arkanoidSkin}
          onSkinChange={setArkanoidSkin}
        />
      )}

      {isAsteroids && (
        <AsteroidsToolbar skin={asteroidsSkin} onChange={setAsteroidsSkin} />
      )}

      {isFroggy && (
        <FroggyToolbar
          skin={froggySkin}
          onSkinChange={setFroggySkin}
          muted={froggyMuted}
          onMutedChange={setFroggyMuted}
        />
      )}

      {isMinesweeper && (
        <MinesweeperToolbar
          skin={minesweeperSkin}
          onSkinChange={setMinesweeperSkin}
          muted={minesweeperMuted}
          onChange={setMinesweeperMuted}
          hintsLeft={hintsLeft}
          canHint={
            hintsActive && hintsLeft > 0 && scoreOver100 && !paused && !over
          }
          onHint={() => setHintSignal((n) => n + 1)}
        />
      )}

      {isSnake && <SnakeToolbar skin={snakeSkin} onChange={setSnakeSkin} />}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{finalScore.toLocaleString("en-US")}</div>
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
