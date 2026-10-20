import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryBrowser } from "@/components/library-browser";
import { getBestScores } from "@/lib/leaderboard";

export const metadata: Metadata = { title: "Library" };

async function Library() {
  const bests = await getBestScores();
  return <LibraryBrowser bests={bests} />;
}

export default function GamesPage() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERT COIN TO PLAY <span className="blink">_</span>
        </div>
      </section>
      <Suspense fallback={<LibraryBrowser bests={null} />}>
        <Library />
      </Suspense>
    </div>
  );
}
