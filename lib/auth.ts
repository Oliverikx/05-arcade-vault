import type { User as SupabaseUser } from "@supabase/supabase-js";

export const USERNAME_RE = /^[A-Z0-9_]{1,12}$/;

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
