"use server";

import { revalidatePath } from "next/cache";
import {
  getPlayerBest,
  getPlayerGlobal,
  getRealGameIds,
} from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreResult =
  { ok: true } | { ok: false; error: "INVALID" | "SAVE FAILED" };

const NAME_RE = /^[A-Z0-9_]{1,12}$/;
const MAX_SCORE = 10_000_000;

export async function saveScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SaveScoreResult> {
  const gameId = typeof input?.gameId === "string" ? input.gameId : "";
  const name =
    typeof input?.name === "string" ? input.name.trim().toUpperCase() : "";
  const score = input?.score;

  if (
    !gameId ||
    !NAME_RE.test(name) ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { ok: false, error: "INVALID" };
  }

  try {
    const supabase = await createClient();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game) return { ok: false, error: "INVALID" };

    const { error } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: name, score });
    if (error) throw error;
  } catch (error) {
    console.error("[saveScore] failed:", error);
    return { ok: false, error: "SAVE FAILED" };
  }

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/hall-of-fame");
  return { ok: true };
}

export type MyBests = {
  global: { rank: number; total: number; games: number } | null;
  games: Record<string, { rank: number; score: number; date: string }>;
};

// YOUR BEST data for the Hall of Fame. The signed-in name only exists in the
// browser (localStorage), so the client asks for it once after mount.
export async function getMyBests(name: string): Promise<MyBests> {
  const normalized = typeof name === "string" ? name.trim().toUpperCase() : "";
  const empty: MyBests = { global: null, games: {} };
  if (!NAME_RE.test(normalized)) return empty;

  const ids = [...(await getRealGameIds())];
  const [global, ...bests] = await Promise.all([
    getPlayerGlobal(normalized),
    ...ids.map((id) => getPlayerBest(id, normalized)),
  ]);
  const games: MyBests["games"] = {};
  ids.forEach((id, i) => {
    const best = bests[i];
    if (best) games[id] = best;
  });
  return {
    global: global
      ? { rank: global.rank, total: global.total, games: global.games }
      : null,
    games,
  };
}
