"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/game-card";
import { CATS, GAMES } from "@/lib/games";

// bests: max score per game id; null when the leaderboard is offline.
export function LibraryBrowser({
  bests,
}: {
  bests: Record<string, number> | null;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");

  const filtered = useMemo(
    () =>
      GAMES.filter(
        (g) =>
          (cat === "ALL" || g.cat === cat) &&
          g.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [q, cat],
  );

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a game by name…"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} best={bests?.[g.id] ?? null} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: "var(--magenta)",
                marginBottom: 12,
              }}
            >
              NO RESULTS
            </div>
            <div>Try another search or category.</div>
          </div>
        )}
      </div>
    </>
  );
}
