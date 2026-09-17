"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { EVENT_CATEGORIES, BANNER_COLORS, calculateUEBFee, formatCurrency } from "@/lib/utils";

type TicketTier = {
  name: string; type: string; price: string; quantity: string;
  description: string; groupSize: string; isInvitationOnly: boolean; accessCode: string;
};

const defaultTier: TicketTier = {
  name: "General Admission", type: "free", price: "0", quantity: "",
  description: "", groupSize: "1", isInvitationOnly: false, accessCode: "",
};

const STEPS = [
  { n: 1, label: "Details", icon: "📋" },
  { n: 2, label: "Tickets", icon: "🎫" },
  { n: 3, label: "Settings", icon: "⚙️" },
];

const TIER_TYPES = [
  { value: "free",            label: "Free",            desc: "No charge" },
  { value: "paid",            label: "Paid",            desc: "Standard ticket" },
  { value: "vip",             label: "VIP",             desc: "Premium access" },
  { value: "early_bird",      label: "Early Bird",      desc: "Limited time" },
  { value: "group",           label: "Group",           desc: "Multiple people" },
  { value: "invitation_only", label: "Invite Only",     desc: "Restricted" },
];

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", category: "conference", type: "standard",
    startDate: "", startTime: "09:00", endDate: "", endTime: "17:00",
    venue: "", address: "", city: "", country: "Nigeria", capacity: "",
    bannerColor: "#6D28D9", requiresApproval: false, refundPolicy: "",
    customConfirmationMessage: "", feeAbsorbedByOrganiser: false,
  });

  const [tiers, setTiers] = useState<TicketTier[]>([{ ...defaultTier }]);

  const upd = (f: string, v: string | boolean) => setForm(x => ({ ...x, [f]: v }));
  const updTier = (i: number, f: string, v: string | boolean) =>
    setTiers(ts => ts.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  const submit = async () => {
    if (!form.title.trim()) { setError("Event title is required"); return; }
    setSubmitting(true); setError("");
    try {
      const startDate = form.startDate ? new Date(`${form.startDate}T${form.startTime}`) : null;
      const endDate = form.endDate ? new Date(`${form.endDate}T${form.endTime}`) : null;
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, startDate, endDate, capacity: form.capacity || null, status: "published",
          ticketTiers: tiers.map(t => ({
            ...t,
            price: t.type === "free" ? "0" : t.price,
            quantity: t.quantity || null,
            groupSize: parseInt(t.groupSize) || 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/events/${data.event.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const hasPaid = tiers.some(t => t.type !== "free" && parseFloat(t.price || "0") > 0);
  const eg = parseFloat(tiers.find(t => t.type !== "free")?.price || "0");
  const fee = calculateUEBFee(eg);

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-10">
          <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>New Event</p>
          <h1 className="heading-1 mb-1" style={{ color: "var(--text-1)" }}>Create your event</h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>
            Free events are always free · Paid events: 8% + ₦100 per ticket
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <button
                onClick={() => i < step - 1 && setStep(s.n)}
                className="flex items-center gap-2.5 group"
                style={{ cursor: i < step - 1 ? "pointer" : "default" }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200"
                  style={{
                    background: step > s.n ? "var(--violet-mid)" : step === s.n ? "var(--violet-bg)" : "var(--surface-2)",
                    color: step > s.n ? "#fff" : step === s.n ? "var(--violet-mid)" : "var(--text-3)",
                    border: `2px solid ${step === s.n ? "var(--violet-mid)" : step > s.n ? "var(--violet-mid)" : "var(--border)"}`,
                  }}
                >
                  {step > s.n ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : s.n}
                </div>
                <span
                  className="hidden sm:block font-semibold text-sm"
                  style={{ color: step >= s.n ? "var(--text-1)" : "var(--text-3)" }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-3"
                  style={{ background: step > s.n ? "var(--violet-mid)" : "var(--border)" }}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
            <span style={{ color: "#DC2626", fontSize: "1.1rem" }}>⚠</span>
            <p style={{ color: "#991B1B", fontSize: "0.85rem", fontWeight: 500 }}>{error}</p>
          </div>
        )}

        <div className="card p-7">

          {/* ── STEP 1: DETAILS ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Event Title *</label>
                <input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Annual Entrepreneurship Summit 2027" className="input" />
              </div>
              <div>
                <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Description</label>
                <textarea value={form.description} onChange={e => upd("description", e.target.value)} rows={4} placeholder="Tell attendees what to expect…" className="input" style={{ resize: "none" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Category</label>
                  <select value={form.category} onChange={e => upd("category", e.target.value)} className="input" style={{ cursor: "pointer" }}>
                    {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Event Format</label>
                  <select value={form.type} onChange={e => upd("type", e.target.value)} className="input" style={{ cursor: "pointer" }}>
                    <option value="standard">Standard</option>
                    <option value="recurring">Recurring</option>
                    <option value="timeslot">Time Slots</option>
                    <option value="virtual">Virtual</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => upd("startDate", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => upd("startTime", e.target.value)} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>End Date</label>
                  <input type="date" value={form.endDate} onChange={e => upd("endDate", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => upd("endTime", e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Venue Name</label>
                <input value={form.venue} onChange={e => upd("venue", e.target.value)} placeholder="e.g. Eko Convention Centre" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>City</label>
                  <input value={form.city} onChange={e => upd("city", e.target.value)} placeholder="Lagos" className="input" />
                </div>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => upd("capacity", e.target.value)} placeholder="Leave blank = unlimited" className="input" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-3" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Banner Colour</label>
                <div className="flex gap-2.5 flex-wrap">
                  {BANNER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => upd("bannerColor", c)}
                      className="w-9 h-9 rounded-xl transition-all duration-200"
                      style={{
                        background: c,
                        transform: form.bannerColor === c ? "scale(1.2)" : "scale(1)",
                        boxShadow: form.bannerColor === c ? `0 4px 12px ${c}80` : "none",
                        outline: form.bannerColor === c ? `2px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: TICKETS ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Ticket Types</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: "0.2rem" }}>Add one or more ticket categories for your event</p>
                </div>
                <button
                  onClick={() => setTiers(ts => [...ts, { ...defaultTier, name: `Ticket ${ts.length + 1}`, type: "paid", price: "5000" }])}
                  className="btn btn-outline btn-sm"
                >
                  + Add Ticket
                </button>
              </div>

              {tiers.map((tier, i) => (
                <div key={i} className="rounded-2xl p-5 space-y-4" style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{ background: "var(--violet-bg)", color: "var(--violet-mid)" }}
                    >
                      {i + 1}
                    </div>
                    {tiers.length > 1 && (
                      <button
                        onClick={() => setTiers(ts => ts.filter((_, idx) => idx !== i))}
                        className="text-sm font-medium transition-colors"
                        style={{ color: "var(--red)" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Name</label>
                      <input value={tier.name} onChange={e => updTier(i, "name", e.target.value)} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Type</label>
                      <select value={tier.type} onChange={e => updTier(i, "type", e.target.value)} className="input" style={{ background: "#fff", cursor: "pointer" }}>
                        {TIER_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {tier.type !== "free" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Price (₦)</label>
                        <input type="number" value={tier.price} onChange={e => updTier(i, "price", e.target.value)} className="input" style={{ background: "#fff" }} />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Quantity (blank = ∞)</label>
                        <input type="number" value={tier.quantity} onChange={e => updTier(i, "quantity", e.target.value)} placeholder="Unlimited" className="input" style={{ background: "#fff" }} />
                      </div>
                    </div>
                  )}
                  {tier.type === "group" && (
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Group Size (people per ticket)</label>
                      <input type="number" value={tier.groupSize} onChange={e => updTier(i, "groupSize", e.target.value)} className="input" style={{ background: "#fff" }} />
                    </div>
                  )}
                  {tier.type === "invitation_only" && (
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Access Code</label>
                      <input value={tier.accessCode} onChange={e => updTier(i, "accessCode", e.target.value)} placeholder="e.g. VIP2027" className="input" style={{ background: "#fff" }} />
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Description (optional)</label>
                    <input value={tier.description} onChange={e => updTier(i, "description", e.target.value)} placeholder="What's included?" className="input" style={{ background: "#fff" }} />
                  </div>
                </div>
              ))}

              {hasPaid && eg > 0 && (
                <div className="rounded-2xl p-5" style={{ background: "var(--violet-bg)", border: "1px solid var(--violet-rim)" }}>
                  <p className="font-bold mb-3" style={{ fontSize: "0.85rem", color: "var(--violet-low)" }}>💡 UEB Fee Breakdown</p>
                  <div className="space-y-1.5">
                    {[
                      { l: "Ticket price", v: formatCurrency(eg) },
                      { l: "UEB fee (8% + ₦100)", v: `− ${formatCurrency(fee)}`, red: true },
                      { l: "You receive", v: formatCurrency(eg - fee), bold: true },
                    ].map(row => (
                      <div key={row.l} className="flex justify-between" style={{ fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--violet-low)", opacity: 0.75 }}>{row.l}</span>
                        <span style={{ fontWeight: row.bold ? 800 : 600, color: row.red ? "var(--red)" : "var(--violet-low)" }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: SETTINGS ── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Toggle: Approval */}
              <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Require Registration Approval</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>Manually review and approve each attendee before their ticket is issued</p>
                </div>
                <label className="toggle ml-4 shrink-0">
                  <input type="checkbox" checked={form.requiresApproval} onChange={e => upd("requiresApproval", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>

              {/* Toggle: Absorb fees */}
              <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Organiser Absorbs UEB Fee</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>Fee is deducted from your earnings, not added to the ticket price</p>
                </div>
                <label className="toggle ml-4 shrink-0">
                  <input type="checkbox" checked={form.feeAbsorbedByOrganiser} onChange={e => upd("feeAbsorbedByOrganiser", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>

              <div>
                <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Refund Policy</label>
                <textarea value={form.refundPolicy} onChange={e => upd("refundPolicy", e.target.value)} rows={3} placeholder="e.g. Full refund available up to 7 days before the event. No refunds after that." className="input" style={{ resize: "none" }} />
              </div>
              <div>
                <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Custom Confirmation Message</label>
                <textarea value={form.customConfirmationMessage} onChange={e => upd("customConfirmationMessage", e.target.value)} rows={3} placeholder="e.g. Thank you! Please arrive 30 minutes early. Business casual attire. Parking available on-site." className="input" style={{ resize: "none" }} />
              </div>

              {/* Summary card */}
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="font-bold mb-3" style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Event Summary</p>
                <div className="space-y-2">
                  {[
                    { icon: "📌", text: form.title || "Untitled Event" },
                    form.startDate && { icon: "📅", text: `${form.startDate} at ${form.startTime}` },
                    form.city && { icon: "📍", text: [form.venue, form.city].filter(Boolean).join(", ") },
                    { icon: "🎫", text: `${tiers.length} ticket type${tiers.length !== 1 ? "s" : ""}` },
                    form.requiresApproval && { icon: "✅", text: "Requires registration approval" },
                  ].filter(Boolean).map((row, i) => row && (
                    <div key={i} className="flex items-start gap-2" style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>
                      <span>{row.icon}</span><span>{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="btn btn-outline"
              style={{ opacity: step === 1 ? 0 : 1, pointerEvents: step === 1 ? "none" : "auto" }}
            >
              ← Back
            </button>
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-primary">
                Continue →
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ minWidth: 160, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="anim-spin-slow" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                    Publishing…
                  </span>
                ) : "🚀 Publish Event"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
