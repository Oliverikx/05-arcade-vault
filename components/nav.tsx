"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const libraryActive = pathname === "/" || pathname.startsWith("/games");
  const hallActive = pathname === "/hall-of-fame";
  const authActive = pathname === "/auth";
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={libraryActive ? "active" : ""}>
            Library
          </Link>
          <Link href="/hall-of-fame" className={hallActive ? "active" : ""}>
            Hall of Fame
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CREDITS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Sign In
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menu"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENU
        </div>
        <Link href="/" className={libraryActive ? "active" : ""} onClick={close}>
          Library
        </Link>
        <Link
          href="/hall-of-fame"
          className={hallActive ? "active" : ""}
          onClick={close}
        >
          Hall of Fame
        </Link>
        <Link href="/auth" className={authActive ? "active" : ""} onClick={close}>
          {user ? "Account" : "Sign In"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CREDITS · 03
        </div>
      </aside>
    </>
  );
}
