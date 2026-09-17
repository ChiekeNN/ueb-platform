"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight "Saved events" store — mirrors Eventbrite's heart button without
 * requiring an account. Persists to localStorage and syncs across tabs.
 */
const KEY = "ueb.saved.events";
const EVENT = "ueb:saved-changed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useSavedEvents() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSaved(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* storage unavailable — keep it in memory only */
    }
    setSaved(next);
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      const current = read();
      const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
      persist(next);
      return next.includes(slug);
    },
    [persist]
  );

  const isSaved = useCallback((slug: string) => saved.includes(slug), [saved]);

  return { saved, toggle, isSaved, count: saved.length };
}
