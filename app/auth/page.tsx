"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/session-provider";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signOut } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn({ name: (user || "PLAYER1").toUpperCase().slice(0, 10) });
    router.push("/");
  };

  const playAsGuest = () => {
    signOut();
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            SYSTEM ACCESS · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>
            SIGN IN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>
            CREATE ACCOUNT
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="px_kai"
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@vault.gg"
              />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
          >
            {tab === "in" ? "ENTER THE VAULT" : "CREATE & PLAY"}
          </button>
        </form>

        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          PLAY AS GUEST
        </button>

        <div className="auth-divider">OR CONTINUE WITH</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS
        </div>
      </div>
    </div>
  );
}
