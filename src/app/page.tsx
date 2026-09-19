import Link from "next/link";
import Navbar from "@/components/Navbar";
import CreateEventLink from "@/components/CreateEventLink";
import { db } from "@/db";
import { events, registrations, ticketTiers } from "@/db/schema";
import { eq, sql, asc, inArray, and, gte } from "drizzle-orm";
import FeaturedEvents from "@/components/FeaturedEvents";
import { formatCurrency } from "@/lib/utils";
import { DEMO_EVENTS } from "@/lib/demo-events";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [ev] = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.status, "published"));
    const [rg] = await db.select({ count: sql<number>`count(*)` }).from(registrations);
    const [rv] = await db.select({ total: sql<string>`COALESCE(SUM(amount_paid::numeric), 0)` }).from(registrations).where(eq(registrations.paymentStatus, "paid"));
    const eventCount = Number(ev?.count ?? 0);
    return { events: eventCount || DEMO_EVENTS.length, registrations: Number(rg?.count ?? 0), revenue: parseFloat(rv?.total ?? "0") };
  } catch {
    return { events: DEMO_EVENTS.length, registrations: 0, revenue: 0 };
  }
}

async function getFeatured() {
  try {
    const rows = await db.select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      tagline: events.tagline,
      description: events.description,
      category: events.category,
      type: events.type,
      format: events.format,
      startDate: events.startDate,
      endDate: events.endDate,
      venue: events.venue,
      city: events.city,
      imageUrl: events.imageUrl,
      bannerColor: events.bannerColor,
      totalRegistrations: events.totalRegistrations,
      capacity: events.capacity,
      status: events.status,
    }).from(events).where(and(eq(events.status, "published"), gte(events.startDate, new Date()))).orderBy(asc(events.startDate)).limit(6);

    if (rows.length === 0) return DEMO_EVENTS.slice(0, 6);

    const ids = rows.map((row) => row.id);
    const tiers = ids.length
      ? await db.select({ id: ticketTiers.id, eventId: ticketTiers.eventId, name: ticketTiers.name, price: ticketTiers.price, type: ticketTiers.type })
        .from(ticketTiers)
        .where(inArray(ticketTiers.eventId, ids))
      : [];

    return rows.map((row) => ({
      ...row,
      tiers: tiers.filter((tier) => tier.eventId === row.id),
    }));
  } catch {
    return DEMO_EVENTS.slice(0, 6);
  }
}

const WORKFLOW = ["Create", "Publish", "Register", "Approve", "Pay", "Ticket", "Verify", "Attend", "Analyse", "Report"];

/** The 25 capabilities from the UEB product brief, grouped into the four pillars an organiser thinks in. */
const CAPABILITIES = [
  {
    title: "Create & publish",
    icon: "🗂️",
    accent: "var(--violet-mid)",
    items: [
      "Create events",
      "Publish event pages",
      "Create recurring events",
      "Create appointment / time-slot events",
      "Manage post-event activities",
    ],
  },
  {
    title: "Ticketing & registration",
    icon: "🎫",
    accent: "#0891B2",
    items: [
      "Sell free and paid tickets",
      "Manage guest registrations",
      "Approve or reject attendees",
      "Manage individual and group tickets",
      "Create invitation-only tickets",
      "Collect customised attendee information",
      "Send invitations",
      "Process payments",
    ],
  },
  {
    title: "On the day",
    icon: "📱",
    accent: "var(--green)",
    items: [
      "Generate unique digital tickets",
      "Generate QR codes",
      "Verify attendees at the venue",
      "Manage seating",
      "Manage vendors",
      "Monitor attendance",
    ],
  },
  {
    title: "Insight & follow-up",
    icon: "📈",
    accent: "#B45309",
    items: [
      "Communicate with attendees",
      "Generate event reports",
      "Analyse ticket sales and attendance",
      "Manage post-event activities",
    ],
  },
];

const ORGANISER_ACTIVITIES = [
  {
    label: "Create an invitation",
    description: "Start with a polished invite and access rules for the right audience.",
    group: "Plan",
    color: "var(--violet-mid)",
  },
  {
    label: "Share a registration form",
    description: "Collect applications from a branded event page or a private link.",
    group: "Plan",
    color: "var(--violet-mid)",
  },
  {
    label: "Receive applications",
    description: "Keep every response, guest detail and custom answer in one inbox.",
    group: "Plan",
    color: "var(--violet-mid)",
  },
  {
    label: "Review attendees",
    description: "Filter the roster by status, ticket, group, slot or invite.",
    group: "Decide",
    color: "#0891B2",
  },
  {
    label: "Approve or reject applicants",
    description: "Move guests through a clear approval queue before a ticket is issued.",
    group: "Decide",
    color: "#0891B2",
  },
  {
    label: "Collect payments",
    description: "Track free, paid and pending settlements with the fee breakdown included.",
    group: "Decide",
    color: "#0891B2",
  },
  {
    label: "Confirm attendance",
    description: "Know who is coming and follow up with guests before the doors open.",
    group: "Ready",
    color: "var(--green)",
  },
  {
    label: "Generate tickets",
    description: "Issue a unique digital pass with a QR code for every approved guest.",
    group: "Ready",
    color: "var(--green)",
  },
  {
    label: "Send tickets",
    description: "Keep delivery and ticket status tied to each attendee record.",
    group: "Ready",
    color: "var(--green)",
  },
  {
    label: "Print guest lists",
    description: "Export a clean roster for venue teams and offline contingency use.",
    group: "On the day",
    color: "#B45309",
  },
  {
    label: "Verify attendees at the entrance",
    description: "Scan QR codes or search ticket numbers with duplicate detection built in.",
    group: "On the day",
    color: "#B45309",
  },
  {
    label: "Track attendance",
    description: "Watch live check-ins, no-shows and attendance rate as the event unfolds.",
    group: "On the day",
    color: "#B45309",
  },
  {
    label: "Manage VIPs",
    description: "Reserve VIP tiers, invite codes and priority access without extra spreadsheets.",
    group: "On the day",
    color: "#B45309",
  },
  {
    label: "Manage seating",
    description: "Build sections, assign seats and hold inventory from the same workspace.",
    group: "On the day",
    color: "#B45309",
  },
  {
    label: "Manage vendors",
    description: "Track exhibitors, stalls, fees, payment status and event-day contacts.",
    group: "Close",
    color: "#7C3AED",
  },
  {
    label: "Prepare a final report",
    description: "Export sales, attendance, feedback and vendor outcomes when it is over.",
    group: "Close",
    color: "#7C3AED",
  },
];

const FEATURES = [
  {
    icon: "🗓️",
    title: "Every Event Type",
    desc: "Standard, recurring series, appointment windows, virtual and hybrid — one platform handles them all.",
  },
  {
    icon: "🎫",
    title: "Smart Ticketing",
    desc: "Free, paid, VIP, group, early-bird and invitation-only tiers with live inventory control.",
  },
  {
    icon: "✅",
    title: "Approval Workflow",
    desc: "Review each guest, approve, hold or reject in bulk. Tickets are issued automatically on approval.",
  },
  {
    icon: "📲",
    title: "QR Code Entry",
    desc: "Every ticket carries a unique QR code. Fast smartphone verification with a full scan audit trail.",
  },
  {
    icon: "💳",
    title: "Flexible Payments",
    desc: "Paystack, Flutterwave, transfer or cash. Absorb the processing fee or pass it to the attendee.",
  },
  {
    icon: "💌",
    title: "Invitation System",
    desc: "Invite guests directly, issue invite codes and track opens, registrations and attendance.",
  },
  {
    icon: "🪑",
    title: "Seating Plans",
    desc: "Build sections and rows, auto-seat approved guests by ticket tier, and block or release seats.",
  },
  {
    icon: "🏪",
    title: "Vendor Management",
    desc: "Track exhibitors and vendors, stall numbers, fees charged and payments collected.",
  },
  {
    icon: "📣",
    title: "Attendee Comms",
    desc: "Email, SMS and WhatsApp announcements to any segment — approved, unpaid, checked in or not.",
  },
  {
    icon: "🚪",
    title: "Door Check-In",
    desc: "Verify by QR scan or ticket number with duplicate and unpaid-ticket detection built in.",
  },
  {
    icon: "📊",
    title: "Live Analytics",
    desc: "Real-time dashboards for registrations, revenue, sales by tier, check-in velocity and no-shows.",
  },
  {
    icon: "🧾",
    title: "Reports & Post-Event",
    desc: "One-click CSV exports, feedback surveys, thank-you campaigns and close-out checklists.",
  },
];

const SEGMENTS = [
  { icon: "💼", label: "Corporate events" },
  { icon: "🎤", label: "Conferences" },
  { icon: "🎓", label: "University events" },
  { icon: "🏛️", label: "Government events" },
  { icon: "⛪", label: "Church events" },
  { icon: "💍", label: "Weddings" },
  { icon: "📚", label: "Seminars" },
  { icon: "🔧", label: "Workshops" },
  { icon: "📋", label: "Training programmes" },
  { icon: "🖼️", label: "Exhibitions" },
  { icon: "🤝", label: "Networking events" },
  { icon: "🎸", label: "Concerts" },
  { icon: "🔒", label: "Private events" },
  { icon: "🧑‍⚖️", label: "Professional associations" },
  { icon: "💝", label: "Fundraising events" },
];

const ROADMAP = [
  {
    phase: "Now",
    title: "Nigeria",
    body: "Lagos, Abuja and Port Harcourt first — naira pricing, local payment rails and venue-ready check-in.",
    icon: "🇳🇬",
    active: true,
  },
  {
    phase: "Next",
    title: "African markets",
    body: "Ghana, Kenya, South Africa and Rwanda with multi-currency pricing, multi-language event pages and regional payouts.",
    icon: "🌍",
    active: false,
  },
  {
    phase: "Then",
    title: "International",
    body: "The long-term vision: UEB as the digital infrastructure for events, anywhere organisers run them.",
    icon: "🛰️",
    active: false,
  },
];

export default async function HomePage() {
  const [stats, featured] = await Promise.all([getStats(), getFeatured()]);
  const hasEvents = featured.length > 0;

  return (
    <div style={{ background: "var(--surface)" }}>
      <Navbar />

      {/* ─── HERO (centred + boxed) ───────────────────────────── */}
      <section
        className="relative overflow-hidden noise"
        style={{
          background: "linear-gradient(150deg, #0A0A0F 0%, #1C1C2E 35%, #2D1B69 65%, #4C1D95 100%)",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Ambient glows — mirrored either side of the centre line so the layout stays balanced */}
        <div
          className="absolute anim-glow"
          style={{
            top: "18%", left: "50%",
            width: 720, height: 720,
            background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 68%)",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "55%", left: "12%",
            width: 420, height: 420,
            background: "radial-gradient(circle, rgba(212,175,55,0.09) 0%, transparent 70%)",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "55%", left: "88%",
            width: 420, height: 420,
            background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
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

        <div className="hero-shell relative z-10 pt-32 pb-24">
          <div className="hero-panel anim-fadeUp">
            {/* Eyebrow badge */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="flex items-center gap-2 glass px-4 py-2 rounded-full" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                <span className="w-2 h-2 rounded-full anim-pulse-ring" style={{ background: "#4ADE80" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
                  Africa&apos;s Event Operating System
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="display-1 text-white anim-fadeUp delay-1 mb-6" style={{ textAlign: "center" }}>
              One platform.<br />
              <span className="text-grad-violet">Every event.</span>
            </h1>

            <p
              className="hero-copy anim-fadeUp delay-2 mb-10"
              style={{
                fontSize: "clamp(1rem, 2vw, 1.15rem)",
                color: "rgba(255,255,255,0.7)",
                maxWidth: 620,
                lineHeight: 1.75,
                fontWeight: 400,
              }}
            >
              Not just a ticket-selling website. UEB is the complete event operating system —
              create, publish, sell, approve, admit, seat, communicate, analyse and close out
              every event from one platform built for African organisers.
            </p>

            <div className="anim-fadeUp delay-3 flex flex-wrap justify-center gap-4 mb-14">
              <CreateEventLink href="/events/create" className="btn btn-white btn-lg">
                Create Your Event
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </CreateEventLink>
              <Link href="/events" className="btn btn-ghost btn-lg">
                Explore Events
              </Link>
            </div>

            {/* Stats */}
            {hasEvents ? (
              <div
                className="hero-stats anim-fadeUp delay-4 grid grid-cols-3 gap-6 pt-10"
                style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
              >
                {[
                  { value: `${stats.events}+`, label: "Live Events" },
                  { value: `${stats.registrations.toLocaleString()}+`, label: "Registrations" },
                  { value: formatCurrency(stats.revenue), label: "Processed" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-grad-violet" style={{ fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "0.35rem", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="anim-fadeUp delay-4 glass flex flex-wrap items-center justify-center gap-3 px-5 py-3.5 rounded-xl">
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>No events yet?</span>
                <form action="/api/seed" method="POST">
                  <button type="submit" className="btn btn-primary btn-sm">Load Demo Data</button>
                </form>
              </div>
            )}

            {/* Capability ticks */}
            <div className="anim-fadeUp delay-5 flex flex-wrap justify-center gap-x-5 gap-y-2 mt-10">
              {["Recurring events", "Time-slot bookings", "Seating", "Vendors", "Group tickets", "Invitation-only"].map(bit => (
                <span key={bit} className="flex items-center gap-1.5" style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="6" stroke="rgba(167,139,250,0.55)" />
                    <path d="M3.6 6.7l1.9 1.9 3.9-4" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {bit}
                </span>
              ))}
            </div>
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
              <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>Upcoming on UEB</p>
              <h2 className="heading-1" style={{ color: "var(--text-1)" }}>Plan your next event</h2>
            </div>
            <Link href="/events" className="btn btn-outline btn-sm">
              View all →
            </Link>
          </div>
          <FeaturedEvents events={featured} />
        </section>
      )}

      {/* ─── CAPABILITIES (the 25-item brief) ─────────────────── */}
      <section className="py-24" style={{ background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>Complete lifecycle</p>
            <h2 className="display-2" style={{ color: "var(--text-1)" }}>
              The whole event,<br />
              <span className="text-grad-ink">not just the tickets</span>
            </h2>
            <p className="mt-4" style={{ color: "var(--text-3)", maxWidth: 560, margin: "1rem auto 0", fontSize: "1rem", lineHeight: 1.7 }}>
              Every step an organiser performs — from the first draft page to the post-event report — lives inside UEB.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CAPABILITIES.map((pillar, i) => (
              <div
                key={pillar.title}
                className="anim-fadeUp p-6 rounded-2xl border feature-card"
                style={{ animationDelay: `${i * 0.08}s`, borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "#fff", border: "1px solid var(--border)" }}>
                    {pillar.icon}
                  </div>
                  <h3 className="font-bold" style={{ fontSize: "0.95rem", color: "var(--text-1)", letterSpacing: "-0.01em" }}>{pillar.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {pillar.items.map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 3, flexShrink: 0 }}>
                        <path d="M2 7.5l3 3 7-7.5" stroke={pillar.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: "0.84rem", color: "var(--text-2)", lineHeight: 1.55 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ORGANISER OPERATIONS ────────────────────────────── */}
      <section id="organiser-operations" className="py-24 max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>For event organisers</p>
            <h2 className="display-2" style={{ color: "var(--text-1)" }}>
              From first invite<br />
              <span className="text-grad-ink">to final report.</span>
            </h2>
            <p className="mt-5" style={{ color: "var(--text-3)", maxWidth: 430, fontSize: "1rem", lineHeight: 1.75 }}>
              Every operational handoff lives in the same workspace. No more stitching together forms, spreadsheets, payment updates and printed lists to run one event.
            </p>
            <CreateEventLink href="/events/create" className="btn btn-primary mt-7">
              Put an event in motion →
            </CreateEventLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ORGANISER_ACTIVITIES.map((activity, i) => (
              <div
                key={activity.label}
                className="group operation-card flex gap-3.5 p-4 rounded-2xl border transition-all duration-300 anim-fadeUp"
                style={{
                  borderColor: "var(--border)",
                  background: "#fff",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg font-black"
                  style={{ background: `color-mix(in srgb, ${activity.color} 12%, transparent)`, color: activity.color, fontSize: "0.72rem" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold" style={{ color: "var(--text-1)", fontSize: "0.87rem", lineHeight: 1.3 }}>
                      {activity.label}
                    </h3>
                    <span className="label-caps" style={{ color: activity.color, fontSize: "0.56rem", letterSpacing: "0.08em" }}>
                      {activity.group}
                    </span>
                  </div>
                  <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.74rem", lineHeight: 1.5 }}>
                    {activity.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURE GRID ────────────────────────────────────── */}
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
                animationDelay: `${i * 0.06}s`,
                borderColor: "var(--border)",
                background: "#fff",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-lg group-hover:scale-105"
                style={{ background: "var(--violet-bg)", transition: "all 0.3s" }}
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

      {/* ─── SEGMENTS ─────────────────────────────────────────── */}
      <section className="py-16" style={{ background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10">
            <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>Who it&apos;s for</p>
            <h2 className="heading-1" style={{ color: "var(--text-1)" }}>Built for every organiser</h2>
            <p style={{ color: "var(--text-3)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
              From 20-person workshops to 50,000-person conventions
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {SEGMENTS.map((m, i) => (
              <div
                key={m.label}
                className="anim-fadeUp segment-chip flex flex-col items-center justify-center gap-2 p-4 rounded-xl cursor-default border"
                style={{ animationDelay: `${i * 0.03}s`, borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span style={{ fontSize: "1.6rem" }}>{m.icon}</span>
                <span className="text-center" style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.01em" }}>{m.label}</span>
              </div>
            ))}
          </div>
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

      {/* ─── ROADMAP / VISION ─────────────────────────────────── */}
      <section className="py-24 max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>Where we&apos;re going</p>
          <h2 className="display-2" style={{ color: "var(--text-1)" }}>
            Built in Nigeria.<br />
            <span className="text-grad-ink">Architected for the world.</span>
          </h2>
          <p className="mt-4" style={{ color: "var(--text-3)", maxWidth: 560, margin: "1rem auto 0", fontSize: "1rem", lineHeight: 1.7 }}>
            The long-term vision: make UEB the digital infrastructure for events — starting with the organisers who need it most.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ROADMAP.map((step, i) => (
            <div
              key={step.title}
              className="anim-fadeUp relative p-7 rounded-2xl border overflow-hidden"
              style={{
                animationDelay: `${i * 0.1}s`,
                borderColor: step.active ? "var(--violet-rim)" : "var(--border)",
                background: step.active ? "linear-gradient(160deg, var(--violet-bg) 0%, #fff 70%)" : "#fff",
                boxShadow: step.active ? "var(--shadow-md)" : "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <span style={{ fontSize: "1.9rem" }}>{step.icon}</span>
                <span className="badge" style={{
                  background: step.active ? "var(--violet-mid)" : "var(--surface-2)",
                  color: step.active ? "#fff" : "var(--text-3)",
                }}>
                  {step.phase}
                </span>
              </div>
              <h3 className="font-black mb-2" style={{ fontSize: "1.15rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>{step.title}</h3>
              <p style={{ fontSize: "0.86rem", color: "var(--text-3)", lineHeight: 1.7 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING CTA ──────────────────────────────────────── */}
      <section className="pb-24 max-w-7xl mx-auto px-5 sm:px-8">
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
              <CreateEventLink href="/events/create" className="btn btn-primary btn-lg">
                Start for Free →
              </CreateEventLink>
              <Link href="/pricing" className="btn btn-outline btn-lg">
                See Full Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>


    </div>
  );
}
