import Link from "next/link";
import Navbar from "@/components/Navbar";
import { db } from "@/db";
import { events, registrations } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import EventCard from "@/components/EventCard";
import { formatCurrency } from "@/lib/utils";

async function getStats() {
  try {
    const [ev] = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.status, "published"));
    const [rg] = await db.select({ count: sql<number>`count(*)` }).from(registrations);
    const [rv] = await db.select({ total: sql<string>`COALESCE(SUM(amount_paid::numeric), 0)` }).from(registrations).where(eq(registrations.paymentStatus, "paid"));
    return { events: Number(ev?.count ?? 0), registrations: Number(rg?.count ?? 0), revenue: parseFloat(rv?.total ?? "0") };
  } catch { return { events: 0, registrations: 0, revenue: 0 }; }
}

async function getFeatured() {
  try {
    return await db.select({
      id: events.id, title: events.title, slug: events.slug, description: events.description,
      category: events.category, startDate: events.startDate, venue: events.venue, city: events.city,
      imageUrl: events.imageUrl, bannerColor: events.bannerColor, totalRegistrations: events.totalRegistrations,
      capacity: events.capacity, status: events.status,
    }).from(events).where(eq(events.status, "published")).orderBy(desc(events.createdAt)).limit(6);
  } catch { return []; }
}

const WORKFLOW = ["Create", "Publish", "Register", "Approve", "Pay", "Ticket", "Verify", "Attend", "Analyse", "Report"];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="1" y="4" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M7 4V2M15 4V2M1 9h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="7" cy="14" r="1.2" fill="currentColor"/>
        <circle cx="11" cy="14" r="1.2" fill="currentColor"/>
        <circle cx="15" cy="14" r="1.2" fill="currentColor"/>
      </svg>
    ),
    title: "Every Event Type",
    desc: "Standard, recurring, virtual, hybrid, time-slot appointments. One platform handles them all.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 1L13.9 7.26L21 8.27L16 13.14L17.18 20.22L11 17.14L4.82 20.22L6 13.14L1 8.27L8.1 7.26L11 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Smart Ticketing",
    desc: "Free, paid, VIP, group, early-bird, and invitation-only tickets with full inventory control.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M9 11l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 11a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    ),
    title: "Approval Workflow",
    desc: "Review each attendee. Approve, reject, or hold. Automatic ticket generation on approval.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="12" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="2" y="12" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M12 12h2v2h-2zM16 12h2M12 16v2M16 16h2v2h-2M16 14v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: "QR Code Entry",
    desc: "Every ticket gets a unique QR code. Fast, secure smartphone verification at any venue.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 17l4-4 4 2 5-6 5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 2v18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: "Live Analytics",
    desc: "Real-time dashboards — registrations, revenue, check-in rates, no-shows and more.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.6"/>
        <circle cx="11" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
        <circle cx="4.5" cy="12" r="1" fill="currentColor"/>
        <circle cx="17.5" cy="12" r="1" fill="currentColor"/>
      </svg>
    ),
    title: "Flexible Payments",
    desc: "Paystack, Flutterwave, bank transfer. Pass fees to attendees or absorb them.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 4h14v10H4z" stroke="currentColor" strokeWidth="1.6" rx="2"/>
        <path d="M8 18h6M11 14v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M8 8h6M8 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: "Invitation System",
    desc: "Invite guests directly. Track opens, registrations, and attendance per invitation.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 6h16M3 10h16M3 14h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="17" cy="17" r="3.5" fill="var(--violet-bg)" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M15.5 17l1 1 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Post-Event Reports",
    desc: "Automatic event performance reports with attendance, revenue, and no-show analytics.",
  },
];

const MARKETS = [
  { icon: "🎓", label: "Universities" },
  { icon: "💼", label: "Corporate" },
  { icon: "⛪", label: "Churches" },
  { icon: "🏛️", label: "Government" },
  { icon: "🎸", label: "Concerts" },
  { icon: "💍", label: "Weddings" },
  { icon: "🤝", label: "Networking" },
  { icon: "🔬", label: "Seminars" },
  { icon: "📋", label: "Training" },
  { icon: "🖼️", label: "Exhibitions" },
  { icon: "💝", label: "Fundraising" },
  { icon: "🔒", label: "Private" },
];

export default async function HomePage() {
  const [stats, featured] = await Promise.all([getStats(), getFeatured()]);
  const hasEvents = featured.length > 0;

  return (
    <div style={{ background: "var(--surface)" }}>
      <Navbar />

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden noise"
        style={{
          background: "linear-gradient(150deg, #0A0A0F 0%, #1C1C2E 35%, #2D1B69 65%, #4C1D95 100%)",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute anim-glow"
          style={{
            top: "15%", left: "60%",
            width: 600, height: 600,
            background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "70%", left: "10%",
            width: 400, height: 400,
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-24 w-full">
          <div className="max-w-4xl">
            {/* Eyebrow badge */}
            <div className="anim-fadeUp flex items-center gap-2.5 mb-10">
              <div className="flex items-center gap-2 glass px-4 py-2 rounded-full" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                <span className="w-2 h-2 rounded-full anim-pulse-ring" style={{ background: "#4ADE80" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
                  Africa&apos;s Event Operating System
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="display-1 text-white anim-fadeUp delay-1 mb-6">
              One platform.<br />
              <span className="text-grad-violet">Every event.</span>
            </h1>

            <p className="anim-fadeUp delay-2 mb-10" style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", color: "rgba(255,255,255,0.65)", maxWidth: 580, lineHeight: 1.7, fontWeight: 400 }}>
              Create, publish, sell tickets, manage registrations, verify attendees, and analyse performance — all in one elegant platform built for Africa.
            </p>

            <div className="anim-fadeUp delay-3 flex flex-wrap gap-4 mb-16">
              <Link href="/events/create" className="btn btn-white btn-lg">
                Create Your Event
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link href="/events" className="btn btn-ghost btn-lg">
                Explore Events
              </Link>
            </div>

            {/* Stats */}
            {hasEvents && (
              <div className="anim-fadeUp delay-4 grid grid-cols-3 gap-6 pt-10" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                {[
                  { value: `${stats.events}+`, label: "Live Events" },
                  { value: `${stats.registrations.toLocaleString()}+`, label: "Registrations" },
                  { value: formatCurrency(stats.revenue), label: "Processed" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-grad-violet" style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "0.35rem", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {!hasEvents && (
              <div className="anim-fadeUp delay-4 glass flex items-center gap-3 px-5 py-3.5 rounded-xl w-fit">
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>No events yet?</span>
                <form action="/api/seed" method="POST">
                  <button type="submit" className="btn btn-primary btn-sm">Load Demo Data</button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-32" style={{ background: "linear-gradient(to bottom, transparent, var(--surface))" }} />
      </section>

      {/* ─── FEATURED EVENTS ──────────────────────────────────── */}
      {hasEvents && (
        <section className="py-20 max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>Upcoming Events</p>
              <h2 className="heading-1" style={{ color: "var(--text-1)" }}>Happening now</h2>
            </div>
            <Link href="/events" className="btn btn-outline btn-sm">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((ev, i) => (
              <div key={ev.id} className="anim-fadeUp" style={{ animationDelay: `${i * 0.08}s` }}>
                <EventCard event={ev} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── MARKETS ──────────────────────────────────────────── */}
      <section className="py-16" style={{ background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10">
            <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>Who it&apos;s for</p>
            <h2 className="heading-1" style={{ color: "var(--text-1)" }}>Built for every organiser</h2>
            <p style={{ color: "var(--text-3)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
              From 20-person workshops to 50,000-person conventions
            </p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
          {MARKETS.map((m, i) => (
            <div
              key={m.label}
              className="anim-fadeUp col-span-1 flex flex-col items-center gap-2 p-3 rounded-xl cursor-default transition-all duration-200 group market-chip"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <span style={{ fontSize: "1.75rem" }}>{m.icon}</span>
              <span className="text-center" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.01em" }}>{m.label}</span>
            </div>
          ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ────────────────────────────────────── */}
      <section className="py-24 max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>The complete stack</p>
          <h2 className="display-2" style={{ color: "var(--text-1)" }}>Replace the chaos<br />
            <span className="text-grad-ink">with one platform</span>
          </h2>
          <p className="mt-4" style={{ color: "var(--text-3)", maxWidth: 520, margin: "1rem auto 0", fontSize: "1rem", lineHeight: 1.7 }}>
            Stop juggling WhatsApp + Google Forms + Excel + email + printed lists + manual verification. UEB replaces them all.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="anim-fadeUp group p-6 rounded-2xl border transition-all duration-300 feature-card"
              style={{
                animationDelay: `${i * 0.07}s`,
                borderColor: "var(--border)",
                background: "#fff",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300 group-hover:scale-105"
                style={{ background: "var(--violet-bg)", color: "var(--violet-mid)", transition: "all 0.3s" }}
              >
                {f.icon}
              </div>
              <h3 className="font-bold mb-2" style={{ fontSize: "0.97rem", color: "var(--text-1)", letterSpacing: "-0.01em" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-3)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WORKFLOW STRIP ───────────────────────────────────── */}
      <section
        className="relative overflow-hidden noise py-20"
        style={{ background: "linear-gradient(135deg, #1C1C2E 0%, #2D1B69 50%, #4C1D95 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
          <p className="label-caps mb-3" style={{ color: "rgba(167,139,250,0.8)" }}>The UEB way</p>
          <h2 className="heading-1 text-white mb-4">One continuous workflow</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", marginBottom: "3rem" }}>
            From idea to insight — nothing falls through the cracks
          </p>
          <div className="flex flex-wrap justify-center items-center gap-3">
            {WORKFLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="glass px-5 py-2.5 rounded-full" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                  <span className="font-semibold text-sm text-white/90">{step}</span>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                    <path d="M1 5h12M9 1l4 4-4 4" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING CTA ──────────────────────────────────────── */}
      <section className="py-24 max-w-7xl mx-auto px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center"
          style={{ background: "linear-gradient(135deg, var(--violet-bg) 0%, #EDE9FE 100%)", border: "1px solid var(--violet-rim)" }}
        >
          <div
            className="absolute top-0 right-0 w-64 h-64 anim-spin-slow opacity-20"
            style={{
              background: "radial-gradient(circle, var(--violet-hi) 0%, transparent 70%)",
              borderRadius: "50%",
              transform: "translate(40%, -40%)",
            }}
          />
          <div className="relative z-10">
            <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>Transparent pricing</p>
            <h2 className="display-2 mb-4" style={{ color: "var(--ink)" }}>
              Free events, forever free.
            </h2>
            <p style={{ fontSize: "1.1rem", color: "var(--text-2)", maxWidth: 520, margin: "0 auto 2rem", lineHeight: 1.7 }}>
              For paid events, just <strong style={{ color: "var(--violet-low)" }}>8% + ₦100</strong> per ticket.
              No setup fees. No monthly subscription to get started.
              When you earn, we earn — that&apos;s the UEB promise.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/events/create" className="btn btn-primary btn-lg">
                Start for Free →
              </Link>
              <Link href="/pricing" className="btn btn-outline btn-lg">
                See Full Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ background: "var(--ink)", color: "#fff" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)" }}>
                  <span className="font-black text-white" style={{ fontSize: "10px" }}>UEB</span>
                </div>
                <span className="font-black text-xl tracking-tight">UEB</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, maxWidth: 260 }}>
                Africa&apos;s Event Operating System. Create, manage, sell, and understand events — all in one place.
              </p>
              <div className="flex gap-3 mt-5">
                {["Twitter/X", "LinkedIn", "Instagram"].map(s => (
                  <div
                    key={s}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                    style={{ background: "rgba(255,255,255,0.07)", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}
                    title={s}
                  >
                    {s[0]}
                  </div>
                ))}
              </div>
            </div>
            {[
              { heading: "Platform", links: [["Discover Events", "/events"], ["Create Event", "/events/create"], ["Dashboard", "/dashboard"], ["Check-In", "/checkin"]] },
              { heading: "Pricing", links: [["Free Events", "/pricing"], ["Paid Tickets", "/pricing"], ["Enterprise", "/pricing"], ["API Access", "/pricing"]] },
              { heading: "Event Types", links: [["Conferences", "/events"], ["Workshops", "/events"], ["Church Events", "/events"], ["Corporate", "/events"], ["University", "/events"]] },
            ].map(col => (
              <div key={col.heading}>
                <p className="label-caps mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>{col.heading}</p>
                <div className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={href}
                      className="block transition-colors duration-200 footer-link"
                      style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="divider-gradient mb-8" style={{ opacity: 0.15 }} />
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)" }}>© 2027 Unique Events Booking Ltd. Built for Africa.</p>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>Free events always free · 8% + ₦100 per paid ticket</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
