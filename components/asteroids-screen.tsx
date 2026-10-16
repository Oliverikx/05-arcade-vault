"use client";

import { useEffect, useRef } from "react";
import {
  createAsteroidsGame,
  type AsteroidsCallbacks,
  type AsteroidsGame,
} from "@/lib/games/asteroids/engine";

interface AsteroidsScreenProps extends AsteroidsCallbacks {
  paused: boolean;
  /** Changing this value resets the engine to its ready screen. */
  runId: number;
  /** Changing this value ends the current run (fires onGameOver). */
  endSignal: number;
}

export function AsteroidsScreen({
  paused,
  runId,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: AsteroidsScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);

  // Always call the latest callbacks without recreating the engine.
  const callbacksRef = useRef<AsteroidsCallbacks>({
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
    if (!canvas) return;
    const game = createAsteroidsGame(canvas, {
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
  }, []);

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

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
