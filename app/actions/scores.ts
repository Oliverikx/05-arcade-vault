"use server";

import { revalidatePath } from "next/cache";
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
