"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateUEBFee, formatCurrency, formatDate, formatTime } from "@/lib/utils";

export type RegTier = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  price: string | number | null;
  quantity?: number | null;
  quantitySold?: number | null;
  groupSize?: number | null;
  isInvitationOnly?: boolean | null;
};
export type RegSlot = {
  id: string;
  label?: string | null;
  startDate: string;
  capacity?: number | null;
  booked?: number | null;
  remaining?: number | null;
  isActive?: boolean | null;
};
export type RegEvent = {
  id: string;
  title: string;
  slug: string;
  type?: string | null;
  format?: string | null;
  venue?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  requiresApproval?: boolean | null;
  feeAbsorbedByOrganiser?: boolean | null;
  waitlistEnabled?: boolean | null;
  soldOut?: boolean | null;
  capacity?: number | null;
  totalRegistrations?: number | null;
  customConfirmationMessage?: string | null;
  customQuestions?: { id: string; label: string; type: string; required: boolean; options?: string[] }[] | null;
};

export type RegResult = {
  requiresApproval: boolean;
  ticketNumber?: string | null;
  qrCode?: string | null;
  checkoutUrl?: string | null;
  total?: number;
  quantity?: number;
  slotLabel?: string | null;
  waitlisted?: boolean;
  message?: string;
};

/**
 * The single registration flow used everywhere a guest can sign up —
 * the event page, the discovery pop-out and the "Get tickets" rail.
 * Handles tiers, quantity/group guests, appointment slots, custom questions,
 * invitation codes, approvals, waitlists and the paid hand-off to checkout.
 */
export default function RegistrationModal({
  event, tiers, slots, initialTierId, initialQuantity = 1, onClose, onRegistered,
}: {
  event: RegEvent;
  tiers: RegTier[];
  slots?: RegSlot[];
  initialTierId?: string | null;
  initialQuantity?: number;
  onClose: () => void;
  onRegistered?: (result: RegResult) => void;
}) {
  const openSlots = useMemo(
    () => (slots ?? []).filter((s) => s.isActive !== false && (s.remaining === null || s.remaining === undefined || s.remaining > 0)),
    [slots]
  );

  const [tierId, setTierId] = useState<string | null>(
    initialTierId ?? tiers.find((t) => (t.quantity ? (t.quantitySold ?? 0) < t.quantity : true))?.id ?? tiers[0]?.id ?? null
  );
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(20, initialQuantity)));
  const [guestNames, setGuestNames] = useState<string[]>(() => Array(Math.max(0, Math.min(20, initialQuantity) - 1)).fill(""));
  const [slotId, setSlotId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegResult | null>(null);
  const [form, setForm] = useState({
    attendeeName: "", attendeeEmail: "", attendeePhone: "", organisation: "", jobTitle: "",
    customAnswers: {} as Record<string, string>,
  });

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const price = parseFloat(String(tier?.price ?? "0"));
  const fee = price > 0 ? calculateUEBFee(price) * quantity : 0;
  const total = event.feeAbsorbedByOrganiser ? price * quantity : price * quantity + fee;
  const soldOut = !!event.soldOut || (!!event.capacity && (event.totalRegistrations ?? 0) >= event.capacity);

  const submit = async () => {
    if (!form.attendeeName.trim() || !form.attendeeEmail.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (openSlots.length > 0 && !slotId) {
      setError("Please choose a time slot.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTierId: tierId ?? undefined,
          ...form,
          quantity,
          guests: guestNames.filter(Boolean),
          slotId: slotId || undefined,
          invitationCode: inviteCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      if (data.waitlisted) {
        const r: RegResult = { requiresApproval: false, waitlisted: true, message: data.message };
        setResult(r);
        onRegistered?.(r);
        return;
      }

      const r: RegResult = {
        requiresApproval: !!data.requiresApproval,
        ticketNumber: data.registration?.ticketNumber ?? null,
        qrCode: data.registration?.qrCode ?? null,
        checkoutUrl: data.checkoutUrl ?? null,
        total: data.breakdown?.total ?? 0,
        quantity,
        slotLabel: data.slotLabel ?? null,
      };
      setResult(r);
      onRegistered?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(10,10,15,0.62)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="anim-scaleIn w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto"
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "#fff", zIndex: 2, borderRadius: "20px 20px 0 0" }}>
          <div className="min-w-0">
            <p className="label-caps" style={{ color: "var(--violet-mid)" }}>Register</p>
            <h3 className="truncate-2" style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", marginTop: "0.2rem" }}>
              {event.title}
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.15rem" }}>
              {formatDate(event.startDate)}{event.feeAbsorbedByOrganiser ? " · fees included" : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--surface)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 text-3xl"
                style={{ background: result.waitlisted ? "#EFF6FF" : result.requiresApproval ? "#FEF3C7" : "#D1FAE5" }}>
                {result.waitlisted ? "🕐" : result.requiresApproval ? "⏳" : "🎉"}
              </div>
              <h4 className="font-black mb-1" style={{ fontSize: "1.1rem", color: result.requiresApproval ? "#92400E" : "var(--green)" }}>
                {result.waitlisted ? "You're on the waitlist" : result.requiresApproval ? "Registration submitted" : "You're registered!"}
              </h4>
              {result.waitlisted ? (
                <p style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>{result.message}</p>
              ) : result.checkoutUrl ? (
                <p style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
                  Complete payment of <strong>{formatCurrency(result.total ?? 0)}</strong> to confirm
                  {result.quantity && result.quantity > 1 ? ` ${result.quantity} tickets` : " your ticket"}.
                </p>
              ) : (
                <p style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
                  Ticket <strong>{result.ticketNumber}</strong>{result.slotLabel ? ` · ${result.slotLabel}` : ""}
                </p>
              )}

              {event.customConfirmationMessage && (
                <div className="rounded-xl p-3 mt-4 text-left" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-2)", lineHeight: 1.6 }}>{event.customConfirmationMessage}</p>
                </div>
              )}

              {result.qrCode && (
                <div className="flex justify-center mt-4">
                  <div className="rounded-2xl p-2" style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.qrCode} alt="Ticket QR code" style={{ width: 150, height: 150, display: "block" }} />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {result.checkoutUrl && <Link href={result.checkoutUrl} className="btn btn-primary btn-sm">Pay {formatCurrency(result.total ?? 0)} →</Link>}
                {result.ticketNumber && <Link href={`/events/${event.slug}/ticket/${result.ticketNumber}`} className="btn btn-outline btn-sm">Open digital ticket</Link>}
                <button onClick={onClose} className="btn btn-outline btn-sm">Done</button>
              </div>
            </div>
          ) : soldOut && !event.waitlistEnabled ? (
            <div className="text-center py-6">
              <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>🎟️</div>
              <h4 className="font-black mb-2" style={{ fontSize: "1.05rem", color: "var(--text-1)" }}>This event is sold out</h4>
              <p style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>Follow the organiser to hear about returns and future dates.</p>
              <Link href={`/events/${event.slug}`} className="btn btn-outline btn-sm mt-4">View event page</Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
                  <span style={{ color: "var(--red)" }}>⚠</span>
                  <p style={{ fontSize: "0.78rem", color: "#991B1B" }}>{error}</p>
                </div>
              )}

              {/* Tier selection */}
              <div>
                <p className="label-caps mb-2" style={{ color: "var(--text-3)" }}>Ticket type</p>
                <div className="space-y-2">
                  {tiers.map((t) => {
                    const tPrice = parseFloat(String(t.price ?? 0));
                    const tFee = tPrice > 0 ? calculateUEBFee(tPrice) : 0;
                    const full = !!(t.quantity && (t.quantitySold ?? 0) >= t.quantity);
                    const active = tierId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { if (!full) { setTierId(t.id); setQuantity(1); setGuestNames([]); } }}
                        disabled={full}
                        className="w-full text-left p-3.5 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: active ? "var(--violet-mid)" : "var(--border)",
                          background: active ? "var(--violet-bg)" : "#fff",
                          opacity: full ? 0.5 : 1,
                          cursor: full ? "not-allowed" : "pointer",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold" style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>{t.name}</span>
                              {t.isInvitationOnly ? <span className="badge badge-gold" style={{ fontSize: "0.58rem" }}>invite only</span> : null}
                              {t.groupSize && t.groupSize > 1 ? <span className="badge badge-blue" style={{ fontSize: "0.58rem" }}>group of {t.groupSize}</span> : null}
                            </div>
                            {t.description && <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: "0.15rem" }}>{t.description}</p>}
                            {t.quantity ? (
                              <p style={{ fontSize: "0.7rem", color: full ? "var(--red)" : "var(--text-3)", fontWeight: 600, marginTop: "0.15rem" }}>
                                {full ? "Sold out" : `${t.quantity - (t.quantitySold ?? 0)} left`}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black" style={{ fontSize: "0.92rem", color: "var(--text-1)" }}>
                              {tPrice === 0 ? "Free" : formatCurrency(event.feeAbsorbedByOrganiser ? tPrice : tPrice + tFee)}
                            </p>
                            {tPrice > 0 && !event.feeAbsorbedByOrganiser && (
                              <p style={{ fontSize: "0.66rem", color: "var(--text-3)" }}>incl. ₦{tFee.toLocaleString()} fee</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-caps" style={{ color: "var(--text-3)" }}>Tickets</p>
                  <p style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>One QR code per guest</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-outline btn-sm" onClick={() => { const q = Math.max(1, quantity - 1); setQuantity(q); setGuestNames((g) => g.slice(0, q - 1)); }}>−</button>
                  <span className="font-black" style={{ minWidth: 28, textAlign: "center", color: "var(--text-1)" }}>{quantity}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => { const q = Math.min(20, quantity + 1); setQuantity(q); setGuestNames((g) => [...g, ...Array(Math.max(0, q - 1 - g.length)).fill("")]); }}>+</button>
                </div>
              </div>

              {/* Slot picker */}
              {openSlots.length > 0 && (
                <div>
                  <label className="label-caps" style={{ color: "var(--text-3)" }}>Choose a time slot *</label>
                  <select className="input" style={{ fontSize: "0.85rem" }} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                    <option value="">Select a time…</option>
                    {openSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.startDate)} · {s.label ?? formatTime(s.startDate)}
                        {s.remaining !== null && s.remaining !== undefined ? ` (${s.remaining} left)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Attendee details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { f: "attendeeName", ph: "Full name *", type: "text", full: true },
                  { f: "attendeeEmail", ph: "Email *", type: "email", full: true },
                  { f: "attendeePhone", ph: "Phone", type: "tel", full: false },
                  { f: "organisation", ph: "Organisation", type: "text", full: false },
                ].map((inp) => (
                  <input
                    key={inp.f}
                    type={inp.type}
                    placeholder={inp.ph}
                    value={form[inp.f as keyof typeof form] as string}
                    onChange={(e) => setForm((x) => ({ ...x, [inp.f]: e.target.value }))}
                    className="input"
                    style={{ fontSize: "0.85rem", padding: "0.65rem 0.9rem", gridColumn: inp.full ? "1 / -1" : undefined }}
                  />
                ))}
              </div>

              {quantity > 1 && (
                <div className="space-y-2">
                  <p className="label-caps" style={{ color: "var(--text-3)" }}>Guest names (optional)</p>
                  {Array.from({ length: quantity - 1 }).map((_, i) => (
                    <input
                      key={i}
                      className="input"
                      style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}
                      placeholder={`Guest ${i + 2} full name`}
                      value={guestNames[i] ?? ""}
                      onChange={(e) => setGuestNames((g) => g.map((v, idx) => (idx === i ? e.target.value : v)))}
                    />
                  ))}
                </div>
              )}

              {(event.customQuestions ?? []).map((q) => (
                <div key={q.id}>
                  <label className="label-caps" style={{ color: "var(--text-3)" }}>{q.label}{q.required ? " *" : ""}</label>
                  {q.type === "dropdown" && q.options ? (
                    <select className="input" style={{ fontSize: "0.85rem" }} onChange={(e) => setForm((x) => ({ ...x, customAnswers: { ...x.customAnswers, [q.id]: e.target.value } }))}>
                      <option value="">Select…</option>
                      {q.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={q.type === "email" ? "email" : q.type === "number" ? "number" : "text"}
                      className="input"
                      style={{ fontSize: "0.85rem" }}
                      onChange={(e) => setForm((x) => ({ ...x, customAnswers: { ...x.customAnswers, [q.id]: e.target.value } }))}
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="label-caps" style={{ color: "var(--text-3)" }}>
                  Invitation code {tier?.isInvitationOnly ? "*" : "(if you have one)"}
                </label>
                <input
                  className="input"
                  style={{ fontSize: "0.85rem", fontFamily: "monospace" }}
                  placeholder="INV-XXXXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>

              {/* Summary */}
              <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: "0.84rem", color: "var(--text-2)" }}>{quantity} × {tier?.name ?? "ticket"}</span>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-1)" }}>{formatCurrency(price * quantity)}</span>
                </div>
                {fee > 0 && !event.feeAbsorbedByOrganiser && (
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Processing fee (8% + ₦100)</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>{formatCurrency(fee)}</span>
                  </div>
                )}
                <div className="divider-gradient" style={{ margin: "0.6rem 0" }} />
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ fontSize: "0.9rem", color: "var(--text-1)" }}>Total</span>
                  <span className="font-black" style={{ fontSize: "1.05rem", color: "var(--violet-mid)" }}>{total === 0 ? "Free" : formatCurrency(total)}</span>
                </div>
              </div>

              <button className="btn btn-primary w-full justify-center" style={{ padding: "0.85rem" }} disabled={busy} onClick={submit}>
                {busy ? "Registering…" : soldOut ? "Join waitlist" : total > 0 ? "Continue to payment" : "Complete registration"}
              </button>
              <p className="text-center" style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                {event.requiresApproval ? "⏳ Requires organiser approval" : "✅ Instant confirmation"}
                {event.format === "online" ? " · link sent by email" : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
