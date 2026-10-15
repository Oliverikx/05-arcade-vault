"use server";

import { Resend } from "resend";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      message: string;
      fields?: { name: string; email: string; msg: string };
    };

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const msg = field(formData, "msg");
  const company = field(formData, "company");

  // Honeypot: bots fill the hidden field. Pretend success, send nothing.
  if (company) return { status: "success", name: name || "PLAYER" };

  const fields = { name, email, msg };
  const fail = (message: string): ContactState => ({
    status: "error",
    message,
    fields,
  });

  if (!name || !email || !msg) return fail("ALL FIELDS ARE REQUIRED");
  if (name.length > 80) return fail("NAME TOO LONG (MAX 80)");
  if (email.length > 254 || !EMAIL_RE.test(email))
    return fail("INVALID EMAIL ADDRESS");
  if (msg.length > 2000) return fail("MESSAGE TOO LONG (MAX 2000)");

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error(
      "[contact] Missing env var: RESEND_API_KEY and CONTACT_TO_EMAIL are required",
    );
    return fail("TRANSMISSION FAILED. TRY AGAIN LATER.");
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${msg}`,
      html:
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
        `<p><strong>Message:</strong><br>${escapeHtml(msg).replace(/\r?\n/g, "<br>")}</p>`,
    });
    if (error) {
      console.error("[contact] Resend error:", error);
      return fail("TRANSMISSION FAILED. TRY AGAIN LATER.");
    }
  } catch (err) {
    console.error("[contact] Send failed:", err);
    return fail("TRANSMISSION FAILED. TRY AGAIN LATER.");
  }

  return { status: "success", name };
}
