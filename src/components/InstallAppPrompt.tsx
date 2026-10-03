"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  INSTALL_PROMPT_DELAY_MS,
  INSTALL_PROMPT_VISIBLE_MS,
  type BeforeInstallPromptEvent,
  getDeferredPrompt,
  isAppInstalled,
  isInstallPromptSnoozed,
  isStandalone,
  markInstalled,
  registerServiceWorker,
  snoozeInstallPrompt,
  subscribeToInstallPrompt,
} from "@/lib/pwa";

type Phase = "waiting" | "visible" | "done";

/**
 * "Install UEB" offer.
 *
 * Behaviour (deliberate, and the contract this component is built around):
 *
 *   1. Nothing is shown for the first 5 seconds after the app opens —
 *      `INSTALL_PROMPT_DELAY_MS`. Guests get to read the page first.
 *   2. It then stays on screen for 10 seconds — `INSTALL_PROMPT_VISIBLE_MS` —
 *      with a countdown rail, and withdraws on its own if ignored.
 *   3. It never appears when UEB is already installed: an installed app runs in
 *      `standalone` display mode, a previous installation is remembered
 *      (`appinstalled` → `markInstalled()`), and `getInstalledRelatedApps()`
 *      catches installs made in another tab — so re-opening the installed app
 *      stays silent.
 *   4. Where the browser offers a native install dialog (`beforeinstallprompt`,
 *      i.e. Chrome/Edge/Android) the button opens it; everywhere else — iOS
 *      Safari included — the same button reveals that platform's instructions,
 *      so the offer is never a dead end.
 */
export default function InstallAppPrompt() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [showSteps, setShowSteps] = useState(false);
  const [ios, setIos] = useState(false);

  // The deferred install offer, read straight from the store (`lib/pwa.ts`).
  // Subscribing this way also picks up an event that fired before hydration,
  // which a listener added in an effect would have missed.
  const installEvent: BeforeInstallPromptEvent | null = useSyncExternalStore(
    subscribeToInstallPrompt,
    getDeferredPrompt,
    () => null
  );

  // Decide whether this browser is allowed to see the offer at all, then start
  // the 5 second clock.
  useEffect(() => {
    registerServiceWorker();

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    isAppInstalled().then((installed) => {
      if (cancelled) return;
      if (installed || isInstallPromptSnoozed()) {
        setPhase("done");
        return;
      }

      // iOS/iPadOS Safari never fires `beforeinstallprompt`; it gets the manual
      // "Add to Home Screen" recipe instead, so the offer is still useful.
      const ua = window.navigator.userAgent;
      setIos(/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document));

      showTimer = setTimeout(() => {
        if (!cancelled) setPhase("visible");
      }, INSTALL_PROMPT_DELAY_MS);
    });

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, []);

  // Auto-dismiss 10 seconds after it appears. Paused while the guest is reading
  // the manual steps, so the instructions never vanish mid-sentence.
  useEffect(() => {
    if (phase !== "visible" || showSteps) return;
    const hideTimer = setTimeout(() => setPhase("done"), INSTALL_PROMPT_VISIBLE_MS);
    return () => clearTimeout(hideTimer);
  }, [phase, showSteps]);

  // Installed in another tab, or the app moved into standalone mode → hide and
  // remember.
  useEffect(() => {
    const onInstalled = () => {
      markInstalled();
      setPhase("done");
    };
    window.addEventListener("appinstalled", onInstalled);

    const query = window.matchMedia("(display-mode: standalone)");
    const onDisplayMode = (event: MediaQueryListEvent) => {
      if (event.matches) onInstalled();
    };
    query.addEventListener?.("change", onDisplayMode);

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      query.removeEventListener?.("change", onDisplayMode);
    };
  }, []);

  const dismiss = useCallback((remember: boolean) => {
    if (remember) snoozeInstallPrompt();
    setPhase("done");
  }, []);

  const install = useCallback(async () => {
    const event = installEvent ?? getDeferredPrompt();
    if (!event) {
      // No native dialog available — show the platform instructions.
      setShowSteps(true);
      return;
    }
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") markInstalled();
      if (outcome === "accepted" || outcome === "dismissed") setPhase("done");
    } catch {
      setShowSteps(true);
    }
  }, [installEvent]);

  if (phase !== "visible" || isStandalone()) return null;

  const countdownSeconds = Math.round(INSTALL_PROMPT_VISIBLE_MS / 1000);

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Install UEB"
      className="anim-installIn"
      style={{
        position: "fixed",
        zIndex: 90,
        left: "50%",
        bottom: "1rem",
        transform: "translateX(-50%)",
        width: "min(24rem, calc(100vw - 1.5rem))",
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          border: "1.5px solid var(--border)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div className="flex items-start gap-3.5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={48}
            height={48}
            style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-black" style={{ fontSize: "0.95rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                Install the UEB app
              </p>
              <button
                onClick={() => dismiss(true)}
                aria-label="Dismiss install prompt"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-2)", marginTop: "0.2rem", lineHeight: 1.55 }}>
              Add UEB to your home screen — tickets, check-in and dashboards open in one tap, even on a
              weak venue connection.
            </p>

            {showSteps && (
              <p
                className="rounded-xl px-3 py-2 mt-2.5"
                style={{ background: "var(--violet-bg)", color: "var(--violet-low)", fontSize: "0.74rem", fontWeight: 600, lineHeight: 1.6 }}
              >
                {ios
                  ? "Tap the Share button in Safari, then choose “Add to Home Screen”."
                  : "Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”."}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button onClick={install} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                {installEvent ? "Install app" : "How do I install?"}
              </button>
              <button onClick={() => dismiss(false)} className="btn btn-outline btn-sm" style={{ justifyContent: "center" }}>
                Not now
              </button>
            </div>
          </div>
        </div>

        {/* Countdown rail: the prompt withdraws by itself after 10 seconds. */}
        <div style={{ height: 3, background: "var(--surface-2)" }}>
          <div
            className="anim-install-countdown"
            style={{
              height: "100%",
              background: "linear-gradient(90deg, var(--violet-hi), var(--violet))",
              animationPlayState: showSteps ? "paused" : "running",
              animationDuration: `${INSTALL_PROMPT_VISIBLE_MS}ms`,
            }}
          />
        </div>
        <span className="sr-only">This offer closes in {countdownSeconds} seconds.</span>
      </div>
    </div>
  );
}
