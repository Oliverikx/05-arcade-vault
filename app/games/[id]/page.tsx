import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { GAMES, getGame } from "@/lib/games";
import { getGameBoard } from "@/lib/leaderboard";

// One query per request, shared by the stat strip and the TOP SCORES panel.
const loadBoard = cache((id: string) => getGameBoard(id, 10));

async function GlobalBest({ id }: { id: string }) {
  const board = await loadBoard(id);
  const top = board.ok ? board.rows[0] : undefined;
  return <>{top ? top.score.toLocaleString("en-US") : "—"}</>;
}

async function TopScores({ id }: { id: string }) {
  const board = await loadBoard(id);

  if (!board.ok) {
    return <div className="lb-empty offline">LEADERBOARD OFFLINE</div>;
  }
  if (board.rows.length === 0) {
    return (
      <div className="lb-empty">
        <Link href="/games/asteroids/play">NO SCORES YET — BE THE FIRST</Link>
      </div>
    );
  }
  return board.rows.map((r, i) => (
    <div
      key={r.name}
      className={
        "lb-row" +
        (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
      }
    >
      <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
      <div className="pl">
        {r.name}
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          {r.date}
        </div>
      </div>
      <div className="sc">{r.score.toLocaleString("en-US")}</div>
    </div>
  ));
}

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata(
  props: PageProps<"/games/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) return {};
  return { title: game.title, description: game.short };
}

export default async function GameDetail(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 PLAYER</span>
            <span>KEYBOARD / TOUCH</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Plays</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Global best</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                <Suspense fallback="—">
                  <GlobalBest id={game.id} />
                </Suspense>
              </div>
            </div>
            <div>
              <div className="l">Difficulty</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${game.id}/play`} className="btn xl pulse">
              ▶ PLAY NOW
            </Link>
            <Link href="/games" className="btn ghost lg">
              BACK TO VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>TOP SCORES</h3>
          <Suspense fallback={<div className="lb-empty">LOADING...</div>}>
            <TopScores id={game.id} />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}
