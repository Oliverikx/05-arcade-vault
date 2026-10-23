"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/session-provider";
import { PASSWORD_RULES, authErrorMessage, passwordOk } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const router = useRouter();
  const { user, ready } = useSession();
  const [supabase] = useState(() => createClient());
  const [pass, setPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass !== repeat) {
      setError("PASSWORDS DO NOT MATCH");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (err) {
      console.error("updateUser(password) failed", err);
      setError((authErrorMessage(err) ?? err.message).toUpperCase());
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">NEW PASSWORD</h2>
        </div>

        {!ready ? null : !user ? (
          <>
            <div className="auth-banner" role="alert">
              LINK EXPIRED
            </div>
            <Link
              href="/auth?mode=forgot"
              className="btn ghost"
              style={{ width: "100%", marginTop: 10, textAlign: "center" }}
            >
              REQUEST A NEW LINK
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <ul className="pw-rules" aria-label="Password rules">
                {PASSWORD_RULES.map((r) => (
                  <li key={r.id} className={r.test(pass) ? "ok" : ""}>
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="field">
              <label>Repeat password</label>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            {error && (
              <div className="auth-msg error" role="alert">
                {error}
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={busy || !passwordOk(pass)}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "SAVING..." : "SAVE PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
