"use client";
import { useEffect, useState } from "react";
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

/** Inclusive list of ISO dates between two inputs (used to generate time-slot windows). */
function dateRange(start: string, end: string): string[] {
  if (!start) return [];
  if (!end || end <= start) return [start];
  const out: string[] = [];
  const cursor = new Date(start);
  const last = new Date(end);
  let guard = 0;
  while (cursor <= last && guard < 60) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

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
  const [poster, setPoster] = useState<{ url: string; name: string } | null>(null);
  const [posterError, setPosterError] = useState("");
  const [access, setAccess] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        const session = data.session;
        setAccess(Boolean(data.authenticated && session && session.accountStatus === "approved" && ["platform_admin", "org_admin", "event_owner"].includes(session.role)));
      })
      .catch(() => setAccess(false));
  }, []);

  const [form, setForm] = useState({
    title: "", description: "", category: "conference", type: "standard",
    startDate: "", startTime: "09:00", endDate: "", endTime: "17:00",
    venue: "", address: "", city: "", country: "Nigeria", capacity: "",
    bannerColor: "#6D28D9", requiresApproval: false, refundPolicy: "",
    customConfirmationMessage: "", feeAbsorbedByOrganiser: false,
    waitlistEnabled: false, seatSelectionEnabled: false, surveyUrl: "", postEventMessage: "",
  });

  /* Recurring series */
  const [recurrence, setRecurrence] = useState({
    frequency: "weekly" as "daily" | "weekly" | "biweekly" | "monthly",
    interval: "1", count: "8", until: "", time: "09:00", durationMinutes: "120",
    weekdays: [] as number[],
  });

  /* Appointment / time-slot windows */
  const [slotCfg, setSlotCfg] = useState({
    date: "", endDate: "", startTime: "09:00", endTime: "17:00", durationMinutes: "30", capacity: "1",
  });

  /* Seating plan */
  const [seating, setSeating] = useState({ name: "Main Hall", rows: "", seatsPerRow: "", tierName: "" });
  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const [tiers, setTiers] = useState<TicketTier[]>([{ ...defaultTier }]);

  const upd = (f: string, v: string | boolean) => setForm(x => ({ ...x, [f]: v }));
  const updTier = (i: number, f: string, v: string | boolean) =>
    setTiers(ts => ts.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  const uploadPoster = (file: File | undefined) => {
    if (!file) return;
    setPosterError("");
    if (!file.type.startsWith("image/")) {
      setPosterError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPosterError("Please choose an image smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / image.width, maxSide / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          setPosterError("This image could not be prepared. Please try another file.");
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPoster({ url: canvas.toDataURL("image/jpeg", 0.84), name: file.name });
      };
      image.onerror = () => setPosterError("This image could not be read. Please try another file.");
      image.src = String(reader.result);
    };
    reader.onerror = () => setPosterError("This image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  };

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
          imageUrl: poster?.url ?? null,
          ticketTiers: tiers.map(t => ({
            ...t,
            price: t.type === "free" ? "0" : t.price,
            quantity: t.quantity || null,
            groupSize: parseInt(t.groupSize) || 1,
          })),
          // Recurring series configuration (expanded server-side into dated sessions)
          recurrenceRule: form.type === "recurring"
            ? {
                frequency: recurrence.frequency,
                interval: parseInt(recurrence.interval) || 1,
                count: parseInt(recurrence.count) || 1,
                until: recurrence.until || null,
                time: recurrence.time,
                durationMinutes: parseInt(recurrence.durationMinutes) || 120,
                weekdays: recurrence.weekdays.length ? recurrence.weekdays : undefined,
              }
            : null,
          // Appointment / time-slot windows
          slots: form.type === "timeslot" && slotCfg.date
            ? {
                dates: dateRange(slotCfg.date, slotCfg.endDate),
                startTime: slotCfg.startTime,
                endTime: slotCfg.endTime,
                durationMinutes: slotCfg.durationMinutes,
                capacity: slotCfg.capacity,
              }
            : null,
          // Seating plan
          seating: form.seatSelectionEnabled && seating.rows && seating.seatsPerRow
            ? [{ name: seating.name || "Main Hall", rows: seating.rows, seatsPerRow: seating.seatsPerRow, tierName: seating.tierName || null }]
            : null,
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

  if (access === null) {
    return <><Navbar /><main className="max-w-3xl mx-auto px-5 pt-32 pb-20 text-center"><div className="skeleton h-40 rounded-3xl" /></main></>;
  }

  if (!access) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-32 pb-20 text-center">
          <div className="card p-8 sm:p-12">
            <div style={{ fontSize: "3rem" }}>🔒</div>
            <h1 className="display-2 mt-4" style={{ color: "var(--text-1)", fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>Create Event is restricted</h1>
            <p className="mt-4" style={{ color: "var(--text-3)", lineHeight: 1.7 }}>Only approved event organisers and authenticated admins can publish events. Sign in with an approved account or request organiser access.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-7"><a href="/login" className="btn btn-primary">Sign in</a><a href="/organizer/signup" className="btn btn-outline">Request organiser access</a></div>
          </div>
        </main>
      </div>
    );
  }

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

              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <label className="block font-semibold" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Event poster or flyer</label>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Optional · JPG, PNG or WebP</span>
                </div>
                <label
                  className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden cursor-pointer transition-all"
                  style={{ minHeight: 190, border: "1.5px dashed var(--border-2)", background: "var(--surface)" }}
                >
                  {poster ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={poster.url} alt="Event poster preview" style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block" }} />
                      <span className="absolute bottom-3 px-3 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(10,10,15,0.78)", color: "#fff", fontSize: "0.72rem" }}>Choose a different poster</span>
                    </>
                  ) : (
                    <div className="text-center px-6 py-8">
                      <div style={{ fontSize: "2.2rem", marginBottom: "0.4rem" }}>🖼️</div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-2)", fontWeight: 700 }}>Upload your event poster</p>
                      <p style={{ marginTop: "0.25rem", fontSize: "0.74rem", color: "var(--text-3)" }}>Use the artwork attendees should see on your event card.</p>
                      <span className="btn btn-outline btn-sm mt-3">Choose image</span>
                    </div>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadPoster(e.target.files?.[0])} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                </label>
                {poster && (
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <p className="truncate" style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>{poster.name}</p>
                    <button type="button" onClick={() => setPoster(null)} style={{ color: "var(--red)", fontSize: "0.72rem", fontWeight: 700 }}>Remove</button>
                  </div>
                )}
                {posterError && <p className="mt-2" style={{ color: "var(--red)", fontSize: "0.75rem" }}>{posterError}</p>}
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
              {/* ── Recurring series ── */}
              {form.type === "recurring" && (
                <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--violet-bg)", border: "1px solid var(--violet-rim)" }}>
                  <div>
                    <p className="font-bold" style={{ fontSize: "0.88rem", color: "var(--violet-low)" }}>🔁 Recurring series</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
                      UEB expands this rule into individual sessions guests can see on the event page.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Repeats</label>
                      <select value={recurrence.frequency} onChange={e => setRecurrence(r => ({ ...r, frequency: e.target.value as typeof r.frequency }))} className="input" style={{ background: "#fff", cursor: "pointer" }}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Number of sessions</label>
                      <input type="number" value={recurrence.count} onChange={e => setRecurrence(r => ({ ...r, count: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Start time</label>
                      <input type="time" value={recurrence.time} onChange={e => setRecurrence(r => ({ ...r, time: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Session length (minutes)</label>
                      <input type="number" value={recurrence.durationMinutes} onChange={e => setRecurrence(r => ({ ...r, durationMinutes: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-2" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Repeat on (weekly patterns)</label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_LABELS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setRecurrence(r => ({ ...r, weekdays: r.weekdays.includes(i) ? r.weekdays.filter(x => x !== i) : [...r.weekdays, i] }))}
                          className="px-3 py-1.5 rounded-lg font-semibold transition-all"
                          style={{
                            fontSize: "0.76rem",
                            background: recurrence.weekdays.includes(i) ? "var(--violet-mid)" : "#fff",
                            color: recurrence.weekdays.includes(i) ? "#fff" : "var(--text-2)",
                            border: "1px solid var(--violet-rim)",
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Ends by (optional)</label>
                    <input type="date" value={recurrence.until} onChange={e => setRecurrence(r => ({ ...r, until: e.target.value }))} className="input" style={{ background: "#fff" }} />
                  </div>
                </div>
              )}

              {/* ── Appointment / time slots ── */}
              {form.type === "timeslot" && (
                <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--violet-bg)", border: "1px solid var(--violet-rim)" }}>
                  <div>
                    <p className="font-bold" style={{ fontSize: "0.88rem", color: "var(--violet-low)" }}>⏰ Appointment windows</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
                      Guests pick a slot when they register. Slots are generated across the dates you choose.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>From date</label>
                      <input type="date" value={slotCfg.date} onChange={e => setSlotCfg(s => ({ ...s, date: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>To date (optional)</label>
                      <input type="date" value={slotCfg.endDate} onChange={e => setSlotCfg(s => ({ ...s, endDate: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Day starts</label>
                      <input type="time" value={slotCfg.startTime} onChange={e => setSlotCfg(s => ({ ...s, startTime: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Day ends</label>
                      <input type="time" value={slotCfg.endTime} onChange={e => setSlotCfg(s => ({ ...s, endTime: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Slot length (minutes)</label>
                      <input type="number" value={slotCfg.durationMinutes} onChange={e => setSlotCfg(s => ({ ...s, durationMinutes: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Capacity per slot</label>
                      <input type="number" value={slotCfg.capacity} onChange={e => setSlotCfg(s => ({ ...s, capacity: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                  </div>
                </div>
              )}

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

              {/* Toggle: Waitlist */}
              <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Waitlist When Full</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>When capacity is reached, guests join a waitlist instead of being turned away</p>
                </div>
                <label className="toggle ml-4 shrink-0">
                  <input type="checkbox" checked={form.waitlistEnabled} onChange={e => upd("waitlistEnabled", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>

              {/* Toggle: Seating */}
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Manage Seating</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>Create a seating plan and auto-assign seats to approved guests</p>
                  </div>
                  <label className="toggle ml-4 shrink-0">
                    <input type="checkbox" checked={form.seatSelectionEnabled} onChange={e => upd("seatSelectionEnabled", e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
                {form.seatSelectionEnabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Section name</label>
                      <input value={seating.name} onChange={e => setSeating(s => ({ ...s, name: e.target.value }))} className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Rows</label>
                      <input type="number" value={seating.rows} onChange={e => setSeating(s => ({ ...s, rows: e.target.value }))} placeholder="10" className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Seats / row</label>
                      <input type="number" value={seating.seatsPerRow} onChange={e => setSeating(s => ({ ...s, seatsPerRow: e.target.value }))} placeholder="20" className="input" style={{ background: "#fff" }} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Reserved for</label>
                      <select value={seating.tierName} onChange={e => setSeating(s => ({ ...s, tierName: e.target.value }))} className="input" style={{ background: "#fff", cursor: "pointer" }}>
                        <option value="">Any ticket</option>
                        {tiers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Post-event setup */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Post-event setup</p>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Feedback survey link (optional)</label>
                  <input value={form.surveyUrl} onChange={e => upd("surveyUrl", e.target.value)} placeholder="https://forms.example.com/ueb-feedback" className="input" />
                </div>
                <div>
                  <label className="block font-semibold mb-1.5" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>Post-event message (optional)</label>
                  <textarea value={form.postEventMessage} onChange={e => upd("postEventMessage", e.target.value)} rows={2} placeholder="Shown on the event page after the event." className="input" style={{ resize: "none" }} />
                </div>
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
                    form.type === "recurring" && { icon: "🔁", text: `${recurrence.count} sessions · ${recurrence.frequency}` },
                    form.type === "timeslot" && slotCfg.date && { icon: "⏰", text: `${slotCfg.durationMinutes}-minute slots per day` },
                    form.requiresApproval && { icon: "✅", text: "Requires registration approval" },
                    form.waitlistEnabled && { icon: "🕐", text: "Waitlist when capacity is full" },
                    form.seatSelectionEnabled && seating.rows && seating.seatsPerRow && {
                      icon: "🪑",
                      text: `${parseInt(seating.rows) * parseInt(seating.seatsPerRow)} seats in ${seating.name}`,
                    },
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
