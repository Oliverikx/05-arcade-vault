"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { usernameOf } from "@/lib/auth";
import { USER_KEY, type User } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

interface SessionContextValue {
  user: User | null;
  ready: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function toUser(u: SupabaseUser | null): User | null {
  return u ? { id: u.id, email: u.email ?? null, name: usernameOf(u) } : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Session is only known in the browser: read after mount to avoid hydration mismatch.
  useEffect(() => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}

    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(toUser(data.user));
      })
      .catch((err) => console.error("getUser failed", err))
      .finally(() => {
        if (active) setReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session?.user ?? null));
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("signOut failed", error);
    router.refresh();
  }, [supabase, router]);

  const value = useMemo(
    () => ({ user, ready, signOut }),
    [user, ready, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
