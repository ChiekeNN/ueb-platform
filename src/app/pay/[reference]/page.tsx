"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: string; reference: string; provider: string; channel: string; amount: string;
  feeAmount: string; netAmount: string; status: string; payerEmail?: string | null; paidAt?: string | null;
};
type Registration = {
  id: string; attendeeName: string; attendeeEmail: string; status: string; paymentStatus: string;
  ticketNumber?: string | null; qrCode?: string | null; amountPaid?: string | null; quantity?: number | null;
};
type EventT = { id: string; title: string; slug: string; startDate?: string | null; venue?: string | null; city?: string | null; feeAbsorbedByOrganiser?: boolean | null };

const CHANNELS = [
  { value: "card", label: "Card", icon: "💳", hint: "Verve, Mastercard, Visa" },
  { value: "bank_transfer", label: "Bank transfer", icon: "🏦", hint: "Dedicated virtual account" },
  { value: "ussd", label: "USSD", icon: "📱", hint: "*737# style payment" },
  { value: "transfer", label: "Direct transfer", icon: "🧾", hint: "Log a manual bank transfer" },
];

export default function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<EventT | null>(null);
  const [channel, setChannel] = useState("card");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments?reference=${reference}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Payment not found");
      setPayment(json.payment);
      setRegistration(json.registration);
      setEvent(json.event);
      setDone(json.payment?.status === "successful");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => { load(); }, [load]);

  const settle = async (action: "verify" | "fail") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reference, channel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Payment failed");
      if (action === "verify") {
        setDone(true);
        await load();
      } else {
        setError("The payment was declined (sandbox). Try again with another channel.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-5 pt-32"><div className="skeleton h-72 rounded-3xl" /></div>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-5 pt-40 text-center">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💳</div>
          <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)" }}>{error}</h2>
          <Link href="/events" className="btn btn-primary">← Browse events</Link>
        </div>
      </div>
    );
  }

  if (!payment) return null;

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />
      <div className="max-w-xl mx-auto px-5 sm:px-8 pt-28 pb-16">
        <div className="text-center mb-7">
          <p className="label-caps mb-2" style={{ color: "var(--violet-mid)" }}>Secure checkout</p>
          <h1 className="heading-1" style={{ color: "var(--text-1)" }}>{done ? "Payment complete 🎉" : "Complete your payment"}</h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
            {event?.title} · {formatDate(event?.startDate)}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl mb-5" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
            <p style={{ fontSize: "0.82rem", color: "#991B1B" }}>{error}</p>
          </div>
        )}

        <div className="card p-6 mb-5">
          <div className="space-y-3">
            <Row label="Reference" value={<span style={{ fontFamily: "monospace" }}>{payment.reference}</span>} />
            <Row label="Attendee" value={registration?.attendeeName ?? "—"} />
            {registration?.quantity && registration.quantity > 1 ? <Row label="Guests" value={`${registration.quantity} tickets`} /> : null}
            {!event?.feeAbsorbedByOrganiser && <Row label="Processing fee" value={formatCurrency(parseFloat(payment.feeAmount ?? "0"))} />}
            <div className="divider-gradient" />
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ fontSize: "0.95rem", color: "var(--text-1)" }}>Total due</span>
              <span className="font-black" style={{ fontSize: "1.35rem", color: "var(--violet-mid)", letterSpacing: "-0.03em" }}>
                {formatCurrency(parseFloat(payment.amount ?? "0"))}
              </span>
            </div>
            <Row
              label="Status"
              value={
                <span className={`badge ${payment.status === "successful" ? "badge-green" : payment.status === "failed" ? "badge-red" : "badge-amber"}`}>
                  {payment.status}
                </span>
              }
            />
          </div>
        </div>

        {done ? (
          <div className="card p-6 text-center">
            <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>🎟️</div>
            <h3 className="font-black mb-2" style={{ fontSize: "1.05rem", color: "var(--text-1)" }}>Your ticket is ready</h3>
            <p style={{ fontSize: "0.83rem", color: "var(--text-3)", marginBottom: "1.2rem" }}>
              {registration?.ticketNumber
                ? `Ticket ${registration.ticketNumber} has been issued to ${registration.attendeeEmail}.`
                : "Payment received. Your ticket is issued as soon as the organiser approves your registration."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {registration?.ticketNumber && (
                <Link href={`/events/${event?.slug}/ticket/${registration.ticketNumber}`} className="btn btn-primary btn-sm">View digital ticket →</Link>
              )}
              <Link href={`/events/${event?.slug}`} className="btn btn-outline btn-sm">Back to event</Link>
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <p className="font-bold mb-4" style={{ fontSize: "0.9rem", color: "var(--text-1)" }}>Choose a payment channel</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {CHANNELS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setChannel(c.value)}
                  className="p-3.5 rounded-xl text-left border-2 transition-all"
                  style={{
                    borderColor: channel === c.value ? "var(--violet-mid)" : "var(--border)",
                    background: channel === c.value ? "var(--violet-bg)" : "#fff",
                  }}
                >
                  <div style={{ fontSize: "1.1rem" }}>{c.icon}</div>
                  <div className="font-bold" style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>{c.label}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{c.hint}</div>
                </button>
              ))}
            </div>

            <button className="btn btn-primary w-full justify-center" style={{ padding: "0.9rem" }} disabled={busy} onClick={() => settle("verify")}>
              {busy ? "Processing…" : `Pay ${formatCurrency(parseFloat(payment.amount ?? "0"))}`}
            </button>
            <button className="btn btn-outline w-full justify-center mt-2 btn-sm" disabled={busy} onClick={() => settle("fail")}>
              Simulate a declined payment
            </button>
            <p style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "0.9rem", lineHeight: 1.6, textAlign: "center" }}>
              Sandbox gateway. Live Paystack / Flutterwave keys are plugged into
              <span style={{ fontFamily: "monospace" }}> /api/payments</span> — the flow, fees and ticket release are identical.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ fontSize: "0.83rem", color: "var(--text-3)" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
