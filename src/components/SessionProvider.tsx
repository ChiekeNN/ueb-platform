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

type SessionApi = {
  refresh: () => Promise<SessionResponse>;
  /** Clear the local session and ask the server to drop it too. */
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState & SessionApi>({
  ...EMPTY,
  loading: true,
  refresh: async () => EMPTY,
  signOut: async () => {},
});

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ...EMPTY, loading: true });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await res.json()) as SessionResponse;
      // `EMPTY` is spread first so a response that omits a field (or an error
      // payload) can never leave a previous user's role flags behind.
      setState({ ...EMPTY, ...data, user: data.user ?? null, loading: false });
      return { ...EMPTY, ...data, user: data.user ?? null } as SessionResponse;
    } catch {
      // Network hiccup: treat as signed out rather than blocking the UI.
      setState({ ...EMPTY, loading: false });
      return EMPTY;
    }
  }, []);

  /**
   * Sign out. The local session is dropped *first*, optimistically, so the
   * navbar can never keep rendering signed-in links (Dashboard, Admin, Create
   * Event) while the request is in flight or if it fails outright. Only a
   * failed request re-reads the server, because then the cookie may still be
   * live and pretending otherwise would be a lie.
   */
  const signOut = useCallback(async () => {
    setState({ ...EMPTY, loading: false });
    let ok = false;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
