"use server";

import { revalidatePath } from "next/cache";
import {
  getPlayerBest,
  getPlayerGlobal,
  getRealGameIds,
} from "@/lib/leaderboard";
import { USERNAME_RE, usernameOf } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreResult =
  | { ok: true }
  | { ok: false; error: "INVALID" | "UNAUTHENTICATED" | "SAVE FAILED" };

const NAME_RE = USERNAME_RE;
const MAX_SCORE = 10_000_000;

export async function saveScore(input: {
  gameId: string;
  score: number;
}): Promise<SaveScoreResult> {
  const gameId = typeof input?.gameId === "string" ? input.gameId : "";
  const score = input?.score;

  if (
    !gameId ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { ok: false, error: "INVALID" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const name = usernameOf(user);
    if (!user || !name) return { ok: false, error: "UNAUTHENTICATED" };

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game) return { ok: false, error: "INVALID" };

    const { error } = await supabase.from("scores").insert({
      game_id: gameId,
      player_name: name,
      score,
      user_id: user.id,
    });
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

// YOUR BEST data for the Hall of Fame. The signed-in name is known client-side
// after mount (session), so the client asks for it once then.
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
