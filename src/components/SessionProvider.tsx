"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionResponse } from "@/app/api/auth/session/route";

/**
 * Client-side view of "who is signed in".
 *
 * Read from `/api/auth/session` rather than cookies in the root layout: the
 * session cookie is HTTP-only (so it must be read on the server) but reading it
 * in the layout would make every marketing page dynamic. One fetch on mount
 * keeps the public pages statically rendered, and `refresh()` re-reads it after
 * signing in, applying to organise, or being approved.
 */

type SessionState = SessionResponse & { loading: boolean };

const EMPTY: SessionResponse = {
  user: null,
  isAdmin: false,
  isOrganiser: false,
  canAccessDashboard: false,
  next: "signin",
  application: null,
};

const SessionContext = createContext<SessionState & { refresh: () => Promise<SessionResponse> }>({
  ...EMPTY,
  loading: true,
  refresh: async () => EMPTY,
});

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ...EMPTY, loading: true });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await res.json()) as SessionResponse;
      setState({ ...EMPTY, ...data, loading: false });
      return data;
    } catch {
      // Network hiccup: treat as signed out rather than blocking the UI.
      setState({ ...EMPTY, loading: false });
      return EMPTY;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
