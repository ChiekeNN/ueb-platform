"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useSession } from "@/components/SessionProvider";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * Become an organiser.
 *
 * One page, four states, all driven by the session:
 *
 *   signed out  → ask them to sign in first (the application needs an account)
 *   none/rejected → the application form (a rejection can be re-applied)
 *   pending     → the waiting screen with what they submitted
 *   approved    → a shortcut into the dashboard
 */

const ORGANISATION_TYPES = [
  "Company", "Church", "University / school", "Government agency", "Community / club",
  "NGO / foundation", "Media", "Individual / freelancer", "Other",
];
const EVENT_VOLUMES = ["1–2 events", "3–5 events", "6–10 events", "More than 10"];

function BecomeOrganiserInner() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    organisationName: "",
    organisationType: ORGANISATION_TYPES[0],
    website: "",
    phone: "",
    city: "",
    country: "Nigeria",
    about: "",
    expectedEventsPerYear: EVENT_VOLUMES[1],
  });

  const user = session.user;
  const application = session.application;

  const upd = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  /**
   * Prefill from the account without an effect: the stored value wins once the
   * applicant types, otherwise the field shows what their account already knows.
   * Syncing this in a `useEffect` would add a cascading render for nothing.
   */
  const field = (key: "organisationName" | "phone") =>
    form[key] || (key === "organisationName" ? user?.organisation || "" : user?.phone || "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/organiser-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send what the form shows: typed values, with account details as fallback.
        body: JSON.stringify({ ...form, organisationName: field("organisationName"), phone: field("phone") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit your application");
      await session.refresh();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application");
    } finally {
      setBusy(false);
    }
  };

  const [busy, setBusy] = useState(false);

  if (session.loading) {
    return <div className="card p-8 max-w-2xl w-full anim-fadeIn" style={{ color: "var(--text-3)" }}>Checking your account…</div>;
  }

  /* ── signed out ─────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="card p-8 max-w-xl w-full anim-fadeUp text-center">
        <div className="text-4xl mb-3">🎪</div>
        <h1 className="heading-2 mb-2" style={{ fontSize: "1.4rem" }}>Sell tickets on UEB</h1>
        <p className="mb-6" style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.7 }}>
          Create an account, tell us about your events, and a UEB admin will review your application.
          Approved organisers get the full dashboard — create events, sell tickets, manage attendees and check guests in.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup?intent=organiser" className="btn btn-primary justify-center">Create an account</Link>
          <Link href="/login?next=/become-organiser" className="btn btn-outline justify-center">I already have one</Link>
        </div>
      </div>
    );
  }

  /* ── approved ───────────────────────────────────────────────── */
  if (session.canAccessDashboard) {
    return (
      <div className="card p-8 max-w-xl w-full anim-fadeUp text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="heading-2 mb-2" style={{ fontSize: "1.4rem" }}>
          {session.isAdmin ? "You have full platform access" : "You're an approved organiser"}
        </h1>
        <p className="mb-6" style={{ fontSize: "0.88rem", color: "var(--text-2)" }}>
          {session.isAdmin
            ? "Admins can create events, review applications and see everything happening on UEB."
            : "Your dashboard is unlocked — create an event and start selling."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/events/create" className="btn btn-primary justify-center">Create an event</Link>
          <Link href={session.isAdmin ? "/admin" : "/dashboard"} className="btn btn-outline justify-center">
            {session.isAdmin ? "Admin dashboard" : "Go to dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  /* ── pending ────────────────────────────────────────────────── */
  if (session.next === "pending" || done) {
    return (
      <div className="card p-8 max-w-2xl w-full anim-fadeUp">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "#FEF3C7" }}>⏳</div>
          <div className="flex-1">
            <h1 className="heading-2 mb-1" style={{ fontSize: "1.35rem" }}>Application submitted — awaiting review</h1>
            <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.7 }}>
              An admin reviews every organiser application before events can be published, so attendees only
              ever see genuine organisers. You&apos;ll get a notification (bell, top right) as soon as a decision
              is made — nothing else is needed from you.
            </p>
          </div>
        </div>

        {application && (
          <div className="mt-6 rounded-2xl p-5 space-y-2.5" style={{ background: "var(--surface)" }}>
            <p className="label-caps" style={{ color: "var(--text-3)" }}>What you submitted</p>
            {[
              { l: "Organising as", v: application.organisationName },
              { l: "Submitted", v: `${formatDate(application.createdAt)} at ${formatTime(application.createdAt)}` },
              { l: "Status", v: "Pending admin review" },
            ].map((row) => (
              <div key={row.l} className="flex items-center justify-between gap-4">
                <span style={{ fontSize: "0.78rem", color: "var(--text-3)", fontWeight: 600 }}>{row.l}</span>
                <span style={{ fontSize: "0.84rem", color: "var(--text-1)", fontWeight: 700 }}>{row.v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/events" className="btn btn-primary justify-center">Browse events while you wait</Link>
          <Link href="/notifications" className="btn btn-outline justify-center">Open notifications</Link>
        </div>
      </div>
    );
  }

  /* ── form (new or re-application) ───────────────────────────── */
  return (
    <div className="card p-7 sm:p-8 max-w-2xl w-full anim-fadeUp">
      <h1 className="heading-2 mb-1" style={{ fontSize: "1.45rem" }}>Apply to become an event organiser</h1>
      <p className="mb-6" style={{ fontSize: "0.87rem", color: "var(--text-3)", lineHeight: 1.65 }}>
        Tell us who you are and what you plan to host. A UEB admin reviews each application —
        usually within a day — and you&apos;ll be notified either way.
      </p>

      {session.next === "rejected" && (
        <div className="rounded-2xl px-4 py-3.5 mb-6" style={{ background: "#FEE2E2" }}>
          <p className="font-bold" style={{ fontSize: "0.84rem", color: "#991B1B" }}>Your previous application was declined</p>
          {application?.reviewNote && (
            <p className="mt-1" style={{ fontSize: "0.8rem", color: "#991B1B", lineHeight: 1.6 }}>
              Admin note: “{application.reviewNote}”
            </p>
          )}
          <p className="mt-1" style={{ fontSize: "0.78rem", color: "#991B1B" }}>
            Update your details below and submit again whenever you&apos;re ready.
          </p>
        </div>
      )}

      {params.get("welcome") === "1" && (
        <p className="rounded-2xl px-4 py-3 mb-6" style={{ background: "var(--violet-bg)", color: "var(--violet-low)", fontSize: "0.82rem", fontWeight: 600 }}>
          Account created. One last step — this application.
        </p>
      )}

      {error && (
        <p className="rounded-xl px-4 py-3 mb-5 font-semibold" style={{ background: "#FEE2E2", color: "#991B1B", fontSize: "0.82rem" }} role="alert">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Organisation / brand name</label>
            <input value={field("organisationName")} onChange={(e) => upd("organisationName", e.target.value)} className="input" placeholder="e.g. UPEC University Events" required />
          </div>
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Type</label>
            <select value={form.organisationType} onChange={(e) => upd("organisationType", e.target.value)} className="input">
              {ORGANISATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>City</label>
            <input value={form.city} onChange={(e) => upd("city", e.target.value)} className="input" placeholder="Port Harcourt" />
          </div>
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Phone</label>
            <input value={field("phone")} onChange={(e) => upd("phone", e.target.value)} className="input" placeholder="0803 000 0000" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Website or social page (optional)</label>
            <input value={form.website} onChange={(e) => upd("website", e.target.value)} className="input" placeholder="https://…" />
          </div>
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Events per year</label>
            <select value={form.expectedEventsPerYear} onChange={(e) => upd("expectedEventsPerYear", e.target.value)} className="input">
              {EVENT_VOLUMES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>What kind of events will you run?</label>
          <textarea
            value={form.about}
            onChange={(e) => upd("about", e.target.value)}
            rows={4}
            className="input"
            style={{ resize: "none" }}
            placeholder="e.g. Monthly tech meet-ups and an annual career fair for 500+ students in Port Harcourt."
            required
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button type="submit" className="btn btn-primary justify-center" disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </button>
          <button type="button" className="btn btn-outline justify-center" onClick={() => router.push("/events")}>
            Cancel
          </button>
        </div>
        <p style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
          You can keep browsing and registering for events while your application is reviewed.
        </p>
      </form>
    </div>
  );
}

export default function BecomeOrganiserPage() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
      <Navbar />
      <div className="flex items-start justify-center px-5 pt-28 pb-16">
        <Suspense fallback={<div className="card p-8 max-w-2xl w-full" style={{ color: "var(--text-3)" }}>Loading…</div>}>
          <BecomeOrganiserInner />
        </Suspense>
      </div>
    </div>
  );
}
