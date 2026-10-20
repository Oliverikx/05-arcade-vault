import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  date: string; // DD/MM/YYYY
}

export type Board<T> = { ok: true; rows: T[] } | { ok: false };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function logError(scope: string, error: unknown) {
  console.error(`[leaderboard] ${scope} failed:`, error);
}

export async function getRealGameIds(): Promise<Set<string>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("games").select("id");
    if (error) throw error;
    return new Set(data.map((g) => g.id));
  } catch (error) {
    logError("getRealGameIds", error);
    return new Set();
  }
}

export async function getGameBoard(
  gameId: string,
  limit = 12,
): Promise<Board<BoardRow>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_bests")
      .select("player_name, best, achieved_at")
      .eq("game_id", gameId)
      .order("best", { ascending: false })
      .order("achieved_at", { ascending: true })
      .order("player_name", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return {
      ok: true,
      rows: data.map((r, i) => ({
        rank: i + 1,
        name: r.player_name ?? "",
        score: r.best ?? 0,
        date: formatDate(r.achieved_at),
      })),
    };
  } catch (error) {
    logError("getGameBoard", error);
    return { ok: false };
  }
}

export async function getPlayerBest(
  gameId: string,
  name: string,
): Promise<{ rank: number; score: number; date: string } | null> {
  try {
    const supabase = await createClient();
    // Same ordering as getGameBoard so ranks match the table.
    const { data, error } = await supabase
      .from("player_bests")
      .select("player_name, best, achieved_at")
      .eq("game_id", gameId)
      .order("best", { ascending: false })
      .order("achieved_at", { ascending: true })
      .order("player_name", { ascending: true });
    if (error) throw error;
    const index = data.findIndex((r) => r.player_name === name);
    if (index === -1) return null;
    const row = data[index];
    return {
      rank: index + 1,
      score: row.best ?? 0,
      date: formatDate(row.achieved_at),
    };
  } catch (error) {
    logError("getPlayerBest", error);
    return null;
  }
}

export async function getBestScores(): Promise<Record<string, number> | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_bests")
      .select("game_id, best");
    if (error) throw error;
    const best: Record<string, number> = {};
    for (const r of data) {
      if (r.game_id === null || r.best === null) continue;
      best[r.game_id] = Math.max(best[r.game_id] ?? 0, r.best);
    }
    return best;
  } catch (error) {
    logError("getBestScores", error);
    return null;
  }
}
