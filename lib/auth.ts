import type { User as SupabaseUser } from "@supabase/supabase-js";

export const USERNAME_RE = /^[A-Z0-9_]{1,12}$/;

export const PASSWORD_MIN = 8;

export const PASSWORD_RULES: {
  id: "len" | "lower" | "upper" | "digit" | "symbol";
  label: string;
  test: (p: string) => boolean;
}[] = [
  {
    id: "len",
    label: `MIN ${PASSWORD_MIN} CHARS`,
    test: (p) => p.length >= PASSWORD_MIN,
  },
  { id: "lower", label: "a–z", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "A–Z", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "0–9", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: "SYMBOL", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordOk(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

// Maps Supabase auth errors to generic user-facing text; null = no special case.
export function authErrorMessage(err: {
  code?: string;
  status?: number;
}): string | null {
  if (err.code === "weak_password") return "PASSWORD TOO WEAK";
  if (err.code === "over_request_rate_limit" || err.status === 429)
    return "TOO MANY ATTEMPTS — TRY LATER";
  return null;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

export function usernameOf(user: SupabaseUser | null): string | null {
  const raw = user?.user_metadata?.username;
  if (typeof raw !== "string") return null;
  return USERNAME_RE.test(raw) ? raw : null;
}

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
