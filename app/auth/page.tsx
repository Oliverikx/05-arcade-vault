"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useSession } from "@/components/session-provider";
import { USERNAME_RE, normalizeUsername, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type Mode = "in" | "up" | "forgot";
type Sent = { kind: "signup" | "recovery"; email: string } | null;

const USERNAME_ERROR = "A–Z, 0–9, _ · MAX 12";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthView />
    </Suspense>
  );
}

function AuthView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, ready, signOut } = useSession();
  const [supabase] = useState(() => createClient());

  const next = safeNext(params.get("next"));
  const stepUsername = params.get("step") === "username";

  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "forgot" ? "forgot" : "in",
  );
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [usernameError, setUsernameError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);
  const [busy, setBusy] = useState(false);

  const linkError = params.get("error") === "link";

  const reset = () => {
    setError(null);
    setInfo(null);
    setUnconfirmed(false);
    setUsernameError(false);
  };
  const switchMode = (m: Mode) => {
    reset();
    setUsername("");
    setEmail("");
    setPass("");
    setMode(m);
  };
  const fail = (message: string) => setError(message.toUpperCase());

  const confirmUrl = (to: string) =>
    `${window.location.origin}/auth/confirm?next=${encodeURIComponent(to)}`;

  const signUp = async () => {
    const name = normalizeUsername(username);
    if (!USERNAME_RE.test(name)) {
      setUsernameError(true);
      return;
    }
    const { error: err } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { username: name }, emailRedirectTo: confirmUrl(next) },
    });
    if (err) {
      console.error("signUp failed", err);
      fail(err.message);
      return;
    }
    setSent({ kind: "signup", email });
  };

  const signIn = async () => {
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (err) {
      console.error("signIn failed", err);
      if (err.code === "email_not_confirmed") {
        setUnconfirmed(true);
        setError("CONFIRM YOUR EMAIL BEFORE SIGNING IN");
      } else fail(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const forgot = async () => {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: confirmUrl("/auth/reset"),
    });
    if (err) {
      console.error("resetPasswordForEmail failed", err);
      fail(err.message);
      return;
    }
    setSent({ kind: "recovery", email });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    reset();
    setBusy(true);
    try {
      if (mode === "up") await signUp();
      else if (mode === "in") await signIn();
      else await forgot();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    reset();
    setBusy(true);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmUrl(next) },
    });
    setBusy(false);
    if (err) {
      console.error("resend failed", err);
      fail(err.message);
      return;
    }
    setInfo("EMAIL SENT");
  };

  const oauth = async (provider: Provider) => {
    reset();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      console.error("oauth failed", err);
      fail(err.message);
    }
  };

  const pickUsername = async (e: FormEvent) => {
    e.preventDefault();
    reset();
    const name = normalizeUsername(username);
    if (!USERNAME_RE.test(name)) {
      setUsernameError(true);
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({
      data: { username: name },
    });
    setBusy(false);
    if (err) {
      console.error("updateUser failed", err);
      fail(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const header = (
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
  );

  const messages = (
    <>
      {error && (
        <div className="auth-msg error" role="alert">
          {error}
        </div>
      )}
      {info && <div className="auth-msg info">{info}</div>}
    </>
  );

  const usernameField = (
    <div className="field">
      <label>Username</label>
      <input
        value={username}
        onChange={(e) => {
          setUsernameError(false);
          setUsername(e.target.value.toUpperCase().slice(0, 12));
        }}
        placeholder="PX_KAI"
        autoComplete="username"
      />
      {usernameError && <div className="field-error">{USERNAME_ERROR}</div>}
    </div>
  );

  if (!ready) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">{header}</div>
      </div>
    );
  }

  // Signed in without a username (first OAuth login) or explicit pick step.
  if (user && (stepUsername || !user.name)) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <form onSubmit={pickUsername}>
            {usernameField}
            {messages}
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "SAVING..." : "PICK USERNAME"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Signed-in view.
  if (user) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="field">
            <label>Player</label>
            <div className="name-readonly">{user.name}</div>
          </div>
          <div className="field">
            <label>Email</label>
            <div className="name-readonly">{user.email}</div>
          </div>
          <button
            className="btn magenta"
            type="button"
            style={{ width: "100%", marginTop: 8 }}
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            SIGN OUT
          </button>
          <button
            className="btn ghost"
            type="button"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => router.push(next)}
          >
            BACK TO THE VAULT
          </button>
        </div>
      </div>
    );
  }

  // Check-your-email panel.
  if (sent) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-msg info">CHECK YOUR EMAIL</div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              textAlign: "center",
              color: "var(--ink-dim)",
              letterSpacing: "0.1em",
            }}
          >
            {sent.kind === "signup"
              ? `CONFIRM YOUR ACCOUNT VIA THE LINK SENT TO ${sent.email.toUpperCase()}`
              : "IF THAT ADDRESS HAS AN ACCOUNT, A RESET LINK IS ON ITS WAY"}
          </div>
          <button
            className="btn ghost"
            type="button"
            style={{ width: "100%", marginTop: 18 }}
            onClick={() => {
              setSent(null);
              switchMode("in");
            }}
          >
            BACK TO SIGN IN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        {header}

        {linkError && (
          <div className="auth-banner" role="alert">
            LINK EXPIRED OR INVALID
          </div>
        )}

        {mode !== "forgot" && (
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "in" ? "on" : ""}
              onClick={() => switchMode("in")}
            >
              SIGN IN
            </button>
            <button
              type="button"
              className={mode === "up" ? "on" : ""}
              onClick={() => switchMode("up")}
            >
              CREATE ACCOUNT
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === "up" && usernameField}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@vault.gg"
              autoComplete="email"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "up" ? "new-password" : "current-password"
                }
                required
              />
            </div>
          )}

          {messages}
          {unconfirmed && (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <button
                className="auth-link"
                type="button"
                onClick={resend}
                disabled={busy}
              >
                RESEND EMAIL
              </button>
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {mode === "in"
              ? "ENTER THE VAULT"
              : mode === "up"
                ? "CREATE ACCOUNT"
                : "SEND RESET LINK"}
          </button>
        </form>

        {mode === "in" && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="auth-link"
              type="button"
              onClick={() => switchMode("forgot")}
            >
              FORGOT PASSWORD?
            </button>
          </div>
        )}
        {mode === "forgot" && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="auth-link"
              type="button"
              onClick={() => switchMode("in")}
            >
              BACK TO SIGN IN
            </button>
          </div>
        )}

        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push(next)}
        >
          PLAY AS GUEST
        </button>

        <div className="auth-divider">OR CONTINUE WITH</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("github")}
          >
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
