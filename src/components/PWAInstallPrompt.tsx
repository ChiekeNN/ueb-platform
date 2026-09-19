"use client";

import { useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    || document.referrer.startsWith("android-app://");
}

export default function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = isInstalled();
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const timer = window.setTimeout(() => {
      if (!standalone) setVisible(true);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  if (!visible || installed) return null;

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setVisible(false);
    setInstallEvent(null);
  };

  return (
    <aside
      role="dialog"
      aria-label="Install UEB"
      className="fixed z-[70] bottom-5 right-5 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl p-4"
      style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "0 18px 55px rgba(10,10,15,0.2)" }}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="UEB" width="46" height="46" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p style={{ color: "var(--text-1)", fontWeight: 900, fontSize: "0.92rem" }}>Install UEB</p>
          <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.75rem", lineHeight: 1.55 }}>
            {isIos ? "Tap Share, then Add to Home Screen to keep UEB close." : installEvent ? "Add UEB to your home screen for faster access to events." : "Use your browser menu and choose Install UEB or Add to Home Screen."}
          </p>
        </div>
        <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss install prompt" style={{ color: "var(--text-3)", fontSize: "1.1rem", lineHeight: 1 }}>×</button>
      </div>
      <div className="flex gap-2 mt-4">
        {installEvent && <button type="button" onClick={install} className="btn btn-primary btn-sm flex-1 justify-center">Install app</button>}
        <button type="button" onClick={() => setVisible(false)} className="btn btn-outline btn-sm flex-1 justify-center">Maybe later</button>
      </div>
    </aside>
  );
}
