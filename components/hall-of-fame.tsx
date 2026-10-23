"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyBests, type MyBests } from "@/app/actions/scores";
import { useSession } from "@/components/session-provider";
import type { Board, BoardRow, GlobalRow } from "@/lib/leaderboard";

const GLOBAL = "GLOBAL";

interface Props {
  tabs: { id: string; title: string }[];
  global: Board<GlobalRow>;
  boards: Record<string, Board<BoardRow>>;
}

// Rows normalized for the shared podium / table UI.
interface HallRow {
  rank: number;
  name: string;
  value: number;
  extra: string; // date (per game) or "N GAMES" (global)
}

const gamesLabel = (n: number) => `${n} ${n === 1 ? "GAME" : "GAMES"}`;

function toHallRows(board: Board<BoardRow | GlobalRow>): HallRow[] | null {
  if (!board.ok) return null;
  return board.rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    value: "score" in r ? r.score : r.total,
    extra: "date" in r ? r.date : gamesLabel(r.games),
  }));
}

function Podium({ rows }: { rows: HallRow[] }) {
  const slot = (i: number, cls: string, label: string, big = false) => {
    const r = rows[i];
    return (
      <div className={"podium-slot " + cls}>
        {big && (
          <div
            className="pixel"
            style={{
              fontSize: 9,
              color: "var(--gold)",
              letterSpacing: "0.18em",
            }}
          >
            CHAMPION
          </div>
        )}
        <div
          className="rank-num"
          style={big ? { fontSize: 36, marginTop: 4 } : undefined}
        >
          {label}
        </div>
        <div className="name">{r ? r.name : "---"}</div>
        <div className="score" style={big ? { fontSize: 20 } : undefined}>
          {r ? r.value.toLocaleString("en-US") : "---"}
        </div>
        <div className="date">{r ? r.extra : "---"}</div>
      </div>
    );
  };
  return (
    <div className="podium">
      {slot(1, "silver", "02")}
      {slot(0, "gold", "01", true)}
      {slot(2, "bronze", "03")}
    </div>
  );
}

export function HallOfFameBoard({ tabs, global, boards }: Props) {
  const { user } = useSession();
  const [tab, setTab] = useState(GLOBAL);
  const [mine, setMine] = useState<{ name: string; data: MyBests } | null>(
    null,
  );

  // The session is only known client-side, so YOUR BEST is fetched once
  // after mount (all tabs together); switching tabs never refetches.
  const userName = user?.name;
  useEffect(() => {
    if (!userName) return;
    let cancelled = false;
    getMyBests(userName)
      .then((data) => {
        if (!cancelled) setMine({ name: userName, data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userName]);
  const myBests = mine && mine.name === userName ? mine.data : null;

  const isGlobal = tab === GLOBAL;
  const rows = toHallRows(isGlobal ? global : boards[tab]);
  const title = isGlobal ? GLOBAL : tabs.find((t) => t.id === tab)!.title;

  let you: HallRow | null = null;
  if (userName && myBests) {
    if (isGlobal && myBests.global) {
      const g = myBests.global;
      you = {
        rank: g.rank,
        name: userName,
        value: g.total,
        extra: gamesLabel(g.games),
      };
    } else if (!isGlobal && myBests.games[tab]) {
      const b = myBests.games[tab];
      you = { rank: b.rank, name: userName, value: b.score, extra: b.date };
    }
  }

  return (
    <>
      <div className="hall-tabs">
        {[{ id: GLOBAL, title: GLOBAL }, ...tabs].map((t) => (
          <button
            key={t.id}
            className={"chip" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="hall-table">
          <div className="lb-empty offline">LEADERBOARD OFFLINE</div>
        </div>
      ) : (
        <>
          <Podium rows={rows} />

          <div className="hall-table">
            <div className="th">
              <div>RANK</div>
              <div>PLAYER</div>
              <div>{isGlobal ? "TOTAL" : "SCORE"}</div>
              <div>{isGlobal ? "GAMES" : "DATE"}</div>
            </div>
            {rows.length === 0 && (
              <div className="lb-empty">
                <Link href={isGlobal ? "/games" : `/games/${tab}/play`}>
                  NO SCORES YET — BE THE FIRST
                </Link>
              </div>
            )}
            {rows.map((r, i) => (
              <div
                key={r.name}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.value.toLocaleString("en-US")}</div>
                <div className="dt">{r.extra}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">▸ YOUR BEST IN {title}</div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(you.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {you.value.toLocaleString("en-US")}
                  </div>
                  <div className="dt">{you.extra}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
