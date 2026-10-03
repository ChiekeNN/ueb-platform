/**
 * Everything the install prompt needs to know about the browser.
 *
 * Kept out of the component so the rules are testable and reusable: the same
 * helpers decide whether UEB is running as an installed app, whether an install
 * offer is available, and whether the guest already said "not now".
 */

/** The Chrome/Edge install event. Not in lib.dom yet, so it is declared here. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/** Wait this long after the app opens before offering installation. */
export const INSTALL_PROMPT_DELAY_MS = 5_000;
/** How long the offer stays on screen before it withdraws by itself. */
export const INSTALL_PROMPT_VISIBLE_MS = 10_000;
/** After an explicit "not now", leave the guest alone for this long. */
export const INSTALL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const INSTALLED_KEY = "ueb:pwa-installed";
const SNOOZED_KEY = "ueb:pwa-snoozed-until";

/* ─── storage (Safari private mode throws on localStorage) ───────── */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the in-memory flags still work for this session */
  }
}

/* ─── installed? ────────────────────────────────────────────────── */

/** True when UEB is already running as an installed app (not in a browser tab). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  if (modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) return true;
  // iOS Safari predates the display-mode media query.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** True when this browser installed UEB before (set on the `appinstalled` event). */
export function isMarkedInstalled(): boolean {
  return read(INSTALLED_KEY) === "1";
}

export function markInstalled() {
  write(INSTALLED_KEY, "1");
}

/**
 * Best-effort detection for an install that happened in another tab or from the
 * app store listing — `getInstalledRelatedApps()` is only implemented on
 * Chromium, and silently returns nothing everywhere else.
 */
export async function hasRelatedAppInstalled(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const api = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<{ id?: string; platform?: string }[]>;
  };
  if (typeof api.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await api.getInstalledRelatedApps();
    return apps.some((app) => app.platform === "webapp" || app.id === window.location.origin);
  } catch {
    return false;
  }
}

/** The single question the prompt asks: should it be shown at all? */
export async function isAppInstalled(): Promise<boolean> {
  if (isStandalone() || isMarkedInstalled()) return true;
  return hasRelatedAppInstalled();
}

export function snoozeInstallPrompt() {
  write(SNOOZED_KEY, String(Date.now() + INSTALL_PROMPT_SNOOZE_MS));
}

export function isInstallPromptSnoozed(): boolean {
  const until = Number(read(SNOOZED_KEY) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

/* ─── the deferred install offer ────────────────────────────────── */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function publish(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  subscribers.forEach((notify) => notify());
}

if (typeof window !== "undefined") {
  // Captured at module scope: the browser can fire this before React hydrates,
  // and an event missed here can never be replayed. `preventDefault` suppresses
  // the browser's own mini-infobar — UEB shows its own prompt instead.
  window.addEventListener("beforeinstallprompt", (event) => {
    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    publish(installEvent);
  });
  window.addEventListener("appinstalled", () => {
    markInstalled();
    publish(null);
  });
}

/**
 * The install offer Chrome/Edge handed us, or `null` when there is none.
 *
 * The returned reference only changes when a new offer arrives, which makes it
 * safe to pair with React's `useSyncExternalStore` — see `InstallAppPrompt`.
 */
export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** Subscribe to install-offer changes; returns the unsubscribe function. */
export function subscribeToInstallPrompt(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/* ─── service worker ────────────────────────────────────────────── */

/**
 * Registers `/sw.js`. Chrome/Edge will not offer installation without it.
 *
 * In development the worker is registered with `?dev=1`, which makes it a pure
 * pass-through (no cache reads or writes) so a stale chunk can never shadow the
 * dev server — while still keeping the app installable while you work on it.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Service workers need a secure context: https, localhost or 127.0.0.1.
  if (!window.isSecureContext) return;

  const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
  const register = () =>
    navigator.serviceWorker.register(url, { scope: "/" }).catch(() => {
      /* registration failures only cost offline support — never break the page */
    });

  // Register once the page has settled, unless it already has (the load event
  // does not fire again after a client-side navigation).
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
