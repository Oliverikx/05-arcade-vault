"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, ready, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const homeActive = pathname === "/";
  const libraryActive = pathname.startsWith("/games");
  const hallActive = pathname === "/hall-of-fame";
  const aboutActive = pathname === "/about";
  const authActive = pathname === "/auth";
  const close = () => setOpen(false);
  const showUser = ready && user;

  // Dropdown closes on route change (adjust state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  // Dropdown closes on outside click / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
          <Link href="/" className={homeActive ? "active" : ""}>
            Home
          </Link>
          <Link href="/games" className={libraryActive ? "active" : ""}>
            Library
          </Link>
          <Link href="/hall-of-fame" className={hallActive ? "active" : ""}>
            Hall of Fame
          </Link>
          <Link href="/about" className={aboutActive ? "active" : ""}>
            About
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CREDITS · 03</span>
        </div>
        {showUser ? (
          <div className="account" ref={accountRef}>
            <button
              className="btn ghost auth-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.name ?? "ACCOUNT"} ▾
            </button>
            {menuOpen && (
              <div className="account-menu" role="menu">
                <Link href="/auth" role="menuitem">
                  Account
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
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
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENU
        </div>
        <Link href="/" className={homeActive ? "active" : ""} onClick={close}>
          Home
        </Link>
        <Link
          href="/games"
          className={libraryActive ? "active" : ""}
          onClick={close}
        >
          Library
        </Link>
        <Link
          href="/hall-of-fame"
          className={hallActive ? "active" : ""}
          onClick={close}
        >
          Hall of Fame
        </Link>
        <Link
          href="/about"
          className={aboutActive ? "active" : ""}
          onClick={close}
        >
          About
        </Link>
        <Link
          href="/auth"
          className={authActive ? "active" : ""}
          onClick={close}
        >
          {showUser ? "Account" : "Sign In"}
        </Link>
        {showUser && (
          <button
            type="button"
            onClick={() => {
              close();
              void signOut();
            }}
          >
            Sign Out
          </button>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CREDITS · 03
        </div>
      </aside>
    </>
  );
}
