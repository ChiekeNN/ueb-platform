"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type Session = { role?: string; email?: string };

const NAV_LINKS = [
  { href: "/",         label: "Home" },
  { href: "/events",   label: "Discover" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/checkin",  label: "Check-In" },
  { href: "/pricing",  label: "Pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const syncSession = () => {
      try {
        const raw = window.localStorage.getItem("ueb.session");
        setSession(raw ? JSON.parse(raw) as Session : null);
      } catch {
        setSession(null);
      }
    };
    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener("ueb:session-changed", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("ueb:session-changed", syncSession);
    };
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  const logout = () => {
    window.localStorage.removeItem("ueb.session");
    window.dispatchEvent(new Event("ueb:session-changed"));
    setSession(null);
    router.push("/login");
  };

  const isHome = path === "/";

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled || !isHome
            ? "rgba(255,255,255,0.92)"
            : "transparent",
          backdropFilter: scrolled || !isHome ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled || !isHome ? "1px solid rgba(226,226,240,0.8)" : "none",
          boxShadow: scrolled ? "0 2px 24px rgba(10,10,15,0.06)" : "none",
        }}
      >
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)" }}
            >
              <span
                className="relative z-10 font-black text-white tracking-tight"
                style={{ fontSize: "10px", letterSpacing: "-0.03em" }}
              >
                UEB
              </span>
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 60%)",
                }}
              />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="font-black text-base tracking-tight"
                style={{ color: scrolled || !isHome ? "var(--ink)" : "#fff", letterSpacing: "-0.03em" }}
              >
                UEB
              </span>
              <span
                className="font-medium hidden sm:block"
                style={{ fontSize: "9px", color: scrolled || !isHome ? "var(--text-3)" : "rgba(255,255,255,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Unique Events Booking
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => {
              const active = link.href === "/" ? path === "/" : path.startsWith(link.href);
              const light = !scrolled && isHome;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    color: active
                      ? (light ? "#fff" : "var(--violet-mid)")
                      : (light ? "rgba(255,255,255,0.75)" : "var(--text-2)"),
                    background: active
                      ? (light ? "rgba(255,255,255,0.15)" : "var(--violet-bg)")
                      : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = light ? "rgba(255,255,255,0.1)" : "var(--surface-2)";
                      (e.currentTarget as HTMLAnchorElement).style.color = light ? "#fff" : "var(--ink)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = active
                        ? (light ? "#fff" : "var(--violet-mid)")
                        : (light ? "rgba(255,255,255,0.75)" : "var(--text-2)");
                    }
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            {session ? (
              <button
                type="button"
                onClick={logout}
                className="hidden sm:inline-flex btn btn-sm"
                style={{
                  background: !scrolled && isHome ? "rgba(255,255,255,0.1)" : "var(--violet-bg)",
                  color: !scrolled && isHome ? "#fff" : "var(--violet-mid)",
                  border: !scrolled && isHome ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--violet-rim)",
                }}
                title={session.email ? `Signed in as ${session.email}` : "Sign out"}
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex btn btn-sm"
                style={{
                  background: !scrolled && isHome ? "rgba(255,255,255,0.1)" : "var(--violet-bg)",
                  color: !scrolled && isHome ? "#fff" : "var(--violet-mid)",
                  border: !scrolled && isHome ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--violet-rim)",
                }}
              >
                Sign in
              </Link>
            )}
            <Link
              href="/events/create"
              className="hidden sm:flex btn btn-primary"
              style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Create Event
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-colors"
              style={{ background: open ? "var(--violet-bg)" : "transparent" }}
              aria-label="Menu"
            >
              <span className="w-5 h-0.5 rounded-full transition-all duration-200" style={{ background: scrolled || !isHome ? (open ? "var(--violet-mid)" : "var(--ink)") : "#fff", transform: open ? "rotate(45deg) translate(3px, 3px)" : "none" }} />
              <span className="w-5 h-0.5 rounded-full transition-all duration-200" style={{ background: scrolled || !isHome ? (open ? "var(--violet-mid)" : "var(--ink)") : "#fff", opacity: open ? 0 : 1 }} />
              <span className="w-5 h-0.5 rounded-full transition-all duration-200" style={{ background: scrolled || !isHome ? (open ? "var(--violet-mid)" : "var(--ink)") : "#fff", transform: open ? "rotate(-45deg) translate(3px, -3px)" : "none" }} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="absolute top-0 right-0 bottom-0 w-72 flex flex-col"
            style={{ background: "#fff", boxShadow: "-8px 0 40px rgba(10,10,15,0.15)" }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="font-black text-base tracking-tight" style={{ color: "var(--ink)" }}>Menu</span>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--surface)" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center px-4 py-3 rounded-xl font-semibold text-sm transition-colors"
                  style={{
                    color: (link.href === "/" ? path === "/" : path.startsWith(link.href)) ? "var(--violet-mid)" : "var(--text-1)",
                    background: (link.href === "/" ? path === "/" : path.startsWith(link.href)) ? "var(--violet-bg)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="p-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              {session ? (
                <button type="button" onClick={logout} className="btn btn-outline w-full justify-center">
                  Sign out
                </button>
              ) : (
                <Link href="/login" className="btn btn-outline w-full justify-center">
                  Sign in
                </Link>
              )}
              <Link href="/events/create" className="btn btn-primary w-full justify-center">
                + Create Event
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
