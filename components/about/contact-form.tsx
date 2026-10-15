"use client";

import { useActionState, useState } from "react";
import { sendContact, type ContactState } from "@/app/about/actions";

const INITIAL: ContactState = { status: "idle" };

export function ContactForm() {
  // Bumping the key remounts the form, resetting action state and fields.
  const [resetKey, setResetKey] = useState(0);
  return (
    <ContactFormInner key={resetKey} onReset={() => setResetKey((k) => k + 1)} />
  );
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(sendContact, INITIAL);
  const [form, setForm] = useState({ name: "", email: "", msg: "" });
  const [shake, setShake] = useState(false);

  // Restore submitted values after a server-side validation error.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error" && state.fields) setForm(state.fields);
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      e.preventDefault();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
    >
      {state.status !== "success" ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NAME</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">EMAIL</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="player@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MESSAGE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Tell us what's on your mind…"
            ></textarea>
          </div>
          <input
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", opacity: 0 }}
          />
          {state.status === "error" && (
            <div className="term-err" role="alert">
              [ERR] {state.message}
            </div>
          )}
          <button
            className="btn xl press"
            type="submit"
            disabled={pending}
            style={{ width: "100%" }}
          >
            {pending ? "▶  TRANSMITTING…" : "▶  SEND MESSAGE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Connecting to server…</div>
            <div className="line dim">[OK] Validating content…</div>
            <div className="line dim">[OK] Transmitting packet…</div>
            <div className="line success">
              &gt; MESSAGE RECEIVED. WE WILL REPLY SOON. THANKS,{" "}
              {state.name.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={onReset}>
                SEND ANOTHER MESSAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
