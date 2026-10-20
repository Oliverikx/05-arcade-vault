"use client";

import { useEffect, useRef } from "react";
import type { GameCallbacks, GameEngine } from "@/lib/games/engine-types";
import type { ArkanoidEngine } from "@/lib/games/arkanoid/engine";
import type { TetrisEngine } from "@/lib/games/tetris/engine";
import type { TetrisAppearance } from "@/components/tetris-toolbar";
import { getEngine } from "@/lib/games/registry";

interface GameScreenProps extends GameCallbacks {
  gameId: string;
  paused: boolean;
  /** Changing this value resets the engine to its ready screen. */
  runId: number;
  /** Changing this value ends the current run (fires onGameOver). */
  endSignal: number;
  /** Skin/theme for engines that support it (tetris). */
  appearance?: TetrisAppearance;
  /** Sound mute for engines that support it (arkanoid). */
  muted?: boolean;
}

export function GameScreen({
  gameId,
  paused,
  runId,
  endSignal,
  appearance,
  muted,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: GameScreenProps) {
  const entry = getEngine(gameId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);

  // Always call the latest callbacks without recreating the engine.
  const callbacksRef = useRef<GameCallbacks>({
    onScore,
    onLives,
    onLevel,
    onGameOver,
  });
  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onGameOver };
  });

  // Prop values already applied to the engine; new engines start in sync.
  const appliedRef = useRef({ runId, endSignal });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entry) return;
    const game = entry.create(canvas, {
      onScore: (s) => callbacksRef.current.onScore(s),
      onLives: (l) => callbacksRef.current.onLives(l),
      onLevel: (l) => callbacksRef.current.onLevel(l),
      onGameOver: (s) => callbacksRef.current.onGameOver(s),
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [entry]);

  useEffect(() => {
    if (!appearance) return;
    const game = gameRef.current as Partial<TetrisEngine> | null;
    game?.setAppearance?.(appearance.skin, appearance.theme);
  }, [appearance, entry]);

  useEffect(() => {
    if (muted === undefined) return;
    const game = gameRef.current as Partial<ArkanoidEngine> | null;
    game?.setMuted?.(muted);
  }, [muted, entry]);

  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (appliedRef.current.runId === runId) return;
    appliedRef.current.runId = runId;
    gameRef.current?.reset();
  }, [runId]);

  useEffect(() => {
    if (appliedRef.current.endSignal === endSignal) return;
    appliedRef.current.endSignal = endSignal;
    gameRef.current?.end();
  }, [endSignal]);

  if (!entry) return null;

  return (
    <canvas
      ref={canvasRef}
      width={entry.width}
      height={entry.height}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
