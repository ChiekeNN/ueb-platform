"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import { useSession } from "@/components/SessionProvider";

/**
 * Public links only. Dashboard and Admin are *not* in this list — they are
 * added per session further down, because the dashboard is for signed-in
 * organisers and admins, never for the public.
 */
const NAV_LINKS = [
  { href: "/events",   label: "Discover" },
  { href: "/checkin",  label: "Check-In" },
  { href: "/pricing",  label: "Pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const session = useSession();

  const user = session.user;
  const signedIn = !!user;
  const canSeeDashboard = session.canAccessDashboard;
  const isAdmin = session.isAdmin;

  /** Links available to this visitor, including the role-gated ones. */
  const links = [
    ...NAV_LINKS,
    ...(signedIn && !canSeeDashboard
      ? [{ href: "/become-organiser", label: session.next === "pending" ? "Application status" : "Sell tickets" }]
      : []),
  ];

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMenuOpen(false);
    setOpen(false);
    await session.refresh();
    router.push("/");
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

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
            {links.map(link => {
              const active = path.startsWith(link.href);
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

          {/* CTA — the bell, the account menu and a role-aware primary action */}
          <div className="flex items-center gap-2 sm:gap-3">
            {signedIn && <NotificationBell />}

            {canSeeDashboard ? (
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
            ) : (
              <Link
                href={signedIn ? "/become-organiser" : "/signup?intent=organiser"}
                className="hidden sm:flex btn btn-primary"
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem" }}
              >
                {session.next === "pending" ? "Application pending" : "Become an organiser"}
              </Link>
            )}

            {signedIn ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-colors"
                  style={{ background: menuOpen ? "var(--violet-bg)" : "transparent" }}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-black"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)", color: "#fff", fontSize: "0.7rem" }}
                  >
                    {user!.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span
                    className="hidden lg:block font-semibold max-w-[7rem] truncate"
                    style={{ fontSize: "0.8rem", color: scrolled || !isHome ? "var(--text-2)" : "#fff" }}
                  >
                    {user!.name.split(" ")[0]}
                  </span>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div
                      className="absolute right-0 z-50 anim-scaleIn rounded-2xl overflow-hidden"
                      style={{ top: "calc(100% + 0.5rem)", width: "15rem", background: "#fff", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-xl)" }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                        <p className="font-bold truncate" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{user!.name}</p>
                        <p className="truncate" style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{user!.email}</p>
                        <span
                          className="badge mt-2"
                          style={{
                            fontSize: "0.6rem",
                            background: isAdmin ? "#FEF3C7" : canSeeDashboard ? "#D1FAE5" : session.next === "pending" ? "#FEF3C7" : "var(--surface-2)",
                            color: isAdmin ? "#92400E" : canSeeDashboard ? "#065F46" : session.next === "pending" ? "#92400E" : "var(--text-2)",
                          }}
                        >
                          {isAdmin ? "Platform admin" : canSeeDashboard ? "Organiser" : session.next === "pending" ? "Application pending" : session.next === "rejected" ? "Application declined" : "Attendee"}
                        </span>
                      </div>
                      <div className="py-1">
                        {[
                          ...(canSeeDashboard ? [{ href: "/dashboard", label: "Dashboard" }] : []),
                          { href: "/notifications", label: "Notifications" },
                          ...(canSeeDashboard ? [] : [{ href: "/become-organiser", label: session.next === "pending" ? "Application status" : "Become an organiser" }]),
                          ...(isAdmin ? [{ href: "/admin", label: "Admin dashboard" }] : []),
                        ].map(item => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className="block px-4 py-2 font-semibold transition-colors"
                            style={{ fontSize: "0.8rem", color: "var(--text-1)" }}
                          >
                            {item.label}
                          </Link>
                        ))}
                        <button
                          onClick={signOut}
                          className="w-full text-left px-4 py-2 font-semibold"
                          style={{ fontSize: "0.8rem", color: "var(--red)" }}
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:flex font-bold"
                style={{ fontSize: "0.85rem", color: scrolled || !isHome ? "var(--text-1)" : "#fff" }}
              >
                Sign in
              </Link>
            )}

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
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center px-4 py-3 rounded-xl font-semibold text-sm transition-colors"
                  style={{
                    color: path.startsWith(link.href) ? "var(--violet-mid)" : "var(--text-1)",
                    background: path.startsWith(link.href) ? "var(--violet-bg)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="p-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
              {signedIn ? (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center font-black"
                      style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)", color: "#fff", fontSize: "0.8rem" }}
                    >
                      {user!.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>{user!.name}</p>
                      <p className="truncate" style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                        {isAdmin ? "Platform admin" : canSeeDashboard ? "Organiser" : "Attendee"}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={canSeeDashboard ? "/events/create" : "/become-organiser"}
                    className="btn btn-primary w-full justify-center"
                    onClick={() => setOpen(false)}
                  >
                    {canSeeDashboard ? "+ Create Event" : "Become an organiser"}
                  </Link>
                  <button onClick={signOut} className="btn btn-outline w-full justify-center">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/signup?intent=organiser" className="btn btn-primary w-full justify-center" onClick={() => setOpen(false)}>
                    Become an organiser
                  </Link>
                  <Link href="/login" className="btn btn-outline w-full justify-center" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
