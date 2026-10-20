import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HallOfFameBoard } from "@/components/hall-of-fame";
import { GAMES } from "@/lib/games";
import {
  getGameBoard,
  getGlobalBoard,
  getRealGameIds,
} from "@/lib/leaderboard";

export const metadata: Metadata = { title: "Hall of Fame" };

// All tabs are fetched once here; tab switching stays client-side.
async function HallData() {
  const realIds = await getRealGameIds();
  const tabs = GAMES.filter((g) => realIds.has(g.id)).map((g) => ({
    id: g.id,
    title: g.title,
  }));
  const [global, ...boards] = await Promise.all([
    getGlobalBoard(12),
    ...tabs.map((t) => getGameBoard(t.id, 12)),
  ]);
  return (
    <HallOfFameBoard
      tabs={tabs}
      global={global}
      boards={Object.fromEntries(tabs.map((t, i) => [t.id, boards[i]]))}
    />
  );
}

export default function HallOfFamePage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          THE NAMES THAT NEVER FADE FROM THE SCREEN
        </p>
      </div>

      <Suspense fallback={<div className="lb-empty">LOADING...</div>}>
        <HallData />
      </Suspense>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </div>
    </div>
  );
}
