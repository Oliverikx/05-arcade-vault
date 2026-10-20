import Link from "next/link";
import { Suspense } from "react";
import {
  FeatureIcon,
  type FeatureIconKind,
} from "@/components/home/feature-icon";
import { FloatingSilhouettes } from "@/components/home/floating-silhouettes";
import { MiniCard } from "@/components/home/mini-card";
import { Reveal } from "@/components/home/reveal";
import { GAMES, getGame, type Accent } from "@/lib/games";
import { getLatestScores, getTodayTopPlayers } from "@/lib/leaderboard";

const FEATURES: {
  icon: FeatureIconKind;
  title: string;
  desc: string;
  color: Accent;
}[] = [
  {
    icon: "GAMEPAD",
    title: "CLASSIC GAMES",
    desc: "Brick Buster, Drop, Snake and more. The best arcade classics in one place.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% FREE",
    desc: "No subscriptions, no hidden fees. Every game is available for free.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "LADDER BOARDS",
    desc: "Compete with players worldwide. Climb the ranking and prove who is the best.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "ALWAYS GROWING",
    desc: "We keep adding new games. Come back often, there is always something new to play.",
    color: "green",
  },
];

const STATS = [
  { n: "8", u: "GAMES", s: "AND COUNTING" },
  { n: "THOUSANDS", u: "OF PLAYS", s: "EVERY DAY" },
  { n: "GLOBAL", u: "RANKING", s: "COMPETE WITH THE WORLD" },
];

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function ActivityState({ offline }: { offline: boolean }) {
  return (
    <div className={"lb-empty" + (offline ? " offline" : "")}>
      {offline ? "LEADERBOARD OFFLINE" : "NO SCORES YET"}
    </div>
  );
}

async function LatestScores() {
  const board = await getLatestScores(7);
  if (!board.ok) return <ActivityState offline />;
  if (board.rows.length === 0) return <ActivityState offline={false} />;
  return (
    <div className="ticker">
      {board.rows.map((r, i) => {
        const game = getGame(r.gameId);
        return (
          <div
            key={`${r.at}-${r.name}-${i}`}
            className="tick-row"
            style={{ animationDelay: i * 60 + "ms" }}
          >
            <span className={"tk-p neon-" + (game?.color ?? "cyan")}>
              {r.name}
            </span>
            <span className="tk-mid">▸ {game?.title ?? r.gameId}</span>
            <span className="tk-s">+{r.score.toLocaleString("en-US")}</span>
            <span className="tk-t">{relativeTime(r.at)}</span>
          </div>
        );
      })}
    </div>
  );
}

async function TopPlayersToday() {
  const board = await getTodayTopPlayers(5);
  if (!board.ok) return <ActivityState offline />;
  if (board.rows.length === 0) return <ActivityState offline={false} />;
  const max = Math.max(board.rows[0].total, 1);
  return (
    <div className="top-list">
      {board.rows.map((r, i) => (
        <div
          key={r.name}
          className={
            "top-row" +
            (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
          <span className="tp-bar">
            <span
              className="tp-fill"
              style={{
                width: Math.max(8, Math.round((r.total / max) * 100)) + "%",
              }}
            ></span>
          </span>
          <span className="tp-p">{r.name}</span>
          <span className="tp-s">{r.total.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

const PLAN_PERKS = [
  "Access to all games",
  "Global ranking and hall of fame",
  "No ads between games",
  "Save your scores",
  "New games every month",
  "Works in any browser",
];

const FAQ = [
  {
    q: "IS IT REALLY FREE?",
    a: 'Yes. Arcade Vault is a non-profit project made out of love for the classics. There is no hidden "premium" version.',
  },
  {
    q: "DO I NEED AN ACCOUNT?",
    a: "No. You can play as a guest. If you want to save your score and appear in the ranking, sign up in 10 seconds.",
  },
  {
    q: "HOW DO YOU SURVIVE WITHOUT CHARGING?",
    a: "It is a community project. If you like it, share it. That is the only coin we accept.",
  },
];

export default function Home() {
  return (
    <div className="home fade-in">
      <Reveal />

      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERT COIN<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">THE CLASSIC</span>
            <span className="line-2">ARCADE IS</span>
            <span className="line-3">BACK</span>
          </h1>
          <p className="home-sub">
            Play the best classics right in your browser.
            <br />
            No downloads. No cost. Just fun.
          </p>
          <div className="home-ctas">
            <Link href="/games" className="btn xl pulse">
              ▶ EXPLORE GAMES
            </Link>
            <Link href="/auth" className="btn xl magenta">
              ✦ CREATE ACCOUNT
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>SCROLL</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">WHY ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.icon}
              className={"feature-card " + f.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <FeatureIcon kind={f.icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">GAMES AVAILABLE NOW</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/games" className="btn lg">
            VIEW ALL GAMES →
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {STATS.map((st, i) => (
            <div
              key={st.u}
              className="stat-block"
              style={{ transitionDelay: i * 90 + "ms" }}
            >
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE ACTIVITY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">LIVE ACTIVITY</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ LATEST SCORES</div>
            </div>
            <Suspense fallback={<div className="lb-empty">LOADING...</div>}>
              <LatestScores />
            </Suspense>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">
                ▸ TOP PLAYERS · TODAY
              </div>
              <Link href="/hall-of-fame" className="lb-link">
                VIEW HALL →
              </Link>
            </div>
            <Suspense fallback={<div className="lb-empty">LOADING...</div>}>
              <TopPlayersToday />
            </Suspense>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRICING</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">SINGLE PLAN</div>
            <div className="pc-name pixel">VAULT PLAYER</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ FOREVER</span>
            </div>
            <div className="pc-tag">NO TRICKS · NO FINE PRINT</div>
            <ul className="pc-list">
              {PLAN_PERKS.map((perk) => (
                <li key={perk}>✔ {perk}</li>
              ))}
            </ul>
            <Link
              href="/auth"
              className="btn xl pulse"
              style={{ width: "100%" }}
            >
              START FREE →
            </Link>
            <div className="pc-foot">
              We don&apos;t ask for a card. We never will.
            </div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((f) => (
              <div key={f.q} className="faq-item">
                <div className="faq-q pixel">{f.q}</div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">READY TO PLAY?</h2>
        <Link href="/games" className="btn xl pulse final-cta">
          INSERT COIN →
        </Link>
        <div className="final-tag">
          Free. No sign-up required. Start in seconds.
        </div>
      </section>
    </div>
  );
}
