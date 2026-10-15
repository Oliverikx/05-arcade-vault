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
import {
  SCORES_KEY,
  USER_KEY,
  type SavedScore,
  type User,
} from "@/lib/session";

interface SessionContextValue {
  user: User | null;
  ready: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
  saveScore: (score: SavedScore) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Read localStorage only after mount to avoid hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(raw ? (JSON.parse(raw) as User | null) : null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, []);

  const signIn = useCallback((next: User) => {
    setUser(next);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const saveScore = useCallback((score: SavedScore) => {
    try {
      const all = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]",
      ) as SavedScore[];
      all.push(score);
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, saveScore }),
    [user, ready, signIn, signOut, saveScore],
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
