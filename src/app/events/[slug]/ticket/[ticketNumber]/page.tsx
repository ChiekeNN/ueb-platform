"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "@/lib/utils";

type Ticket = {
  registration: {
    id: string; attendeeName: string; attendeeEmail: string; attendeePhone?: string | null;
    ticketNumber?: string | null; qrCode?: string | null; status: string; paymentStatus: string;
    amountPaid?: string | null; seatLabel?: string | null; slotLabel?: string | null;
    checkedIn?: boolean | null; quantity?: number | null; organisation?: string | null;
    customAnswers?: Record<string, string> | null;
  };
  event: {
    id: string; title: string; slug: string; venue?: string | null; address?: string | null;
    city?: string | null; country?: string | null; startDate?: string | null; endDate?: string | null;
    bannerColor?: string | null; customConfirmationMessage?: string | null; refundPolicy?: string | null;
  } | null;
  tier: { id: string; name: string; type: string; price: string } | null;
  payment: { reference: string; status: string; amount: string; provider: string; channel: string } | null;
};

export default function TicketPage({ params }: { params: Promise<{ slug: string; ticketNumber: string }> }) {
  const { ticketNumber } = use(params);
  const [data, setData] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketNumber}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ticket not found");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => { load(); }, [load]);

  const calendarLink = () => {
    if (!data?.event?.startDate) return "";
    const start = new Date(data.event.startDate);
    const end = data.event.endDate ? new Date(data.event.endDate) : new Date(start.getTime() + 2 * 3600 * 1000);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
      `SUMMARY:${data.event.title}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `LOCATION:${[data.event.venue, data.event.city, data.event.country].filter(Boolean).join(", ")}`,
      `DESCRIPTION:Ticket ${data.registration.ticketNumber ?? ""} — UEB`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
  };

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-5 pt-32 space-y-4">
          <div className="skeleton h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !data || !data.event) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-5 pt-40 text-center">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎟️</div>
          <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)" }}>{error || "Ticket not found"}</h2>
          <Link href="/events" className="btn btn-primary">← Browse events</Link>
        </div>
      </div>
    );
  }

  const { registration: reg, event, tier, payment } = data;
  const notIssued = !reg.ticketNumber;

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }} className="print-surface">
      <Navbar />

      <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-28 pb-16">
        <div className="flex items-center justify-between mb-6 no-print">
          <Link href={`/events/${event.slug}`} className="btn btn-outline btn-sm">← Event page</Link>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨 Print</button>
            {event.startDate && (
              <a className="btn btn-outline btn-sm" href={calendarLink()} download={`${event.slug}.ics`}>📅 Add to calendar</a>
            )}
          </div>
        </div>

        {/* The ticket */}
        <div className="card overflow-hidden" style={{ borderRadius: "var(--radius-xl)" }}>
          <div
            className="relative px-7 py-7"
            style={{ background: `linear-gradient(135deg, ${event.bannerColor ?? "#6D28D9"}, ${event.bannerColor ?? "#4C1D95"}aa)` }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="label-caps mb-2" style={{ color: "rgba(255,255,255,0.75)" }}>Digital ticket</p>
                <h1 className="heading-2 text-white">{event.title}</h1>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", marginTop: "0.3rem" }}>
                  {formatDate(event.startDate)} · {formatTime(event.startDate)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>{tier?.name ?? "General"}</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="ticket-hole-left no-print" />
            <div className="ticket-hole-right no-print" />
            <div
              className="px-7 py-7 grid grid-cols-1 sm:grid-cols-2 gap-7"
              style={{ borderTop: "2px dashed var(--border-2)" }}
            >
              <div className="space-y-4">
                <Field label="Attendee" value={reg.attendeeName} strong />
                <Field label="Email" value={reg.attendeeEmail} />
                {reg.attendeePhone ? <Field label="Phone" value={reg.attendeePhone} /> : null}
                {reg.organisation ? <Field label="Organisation" value={reg.organisation} /> : null}
                {reg.seatLabel ? <Field label="Seat" value={reg.seatLabel} strong /> : null}
                {reg.slotLabel ? <Field label="Time slot" value={reg.slotLabel} strong /> : null}
                {reg.quantity && reg.quantity > 1 ? <Field label="Group size" value={`${reg.quantity} guests`} /> : null}
                <Field label="Status" value={reg.checkedIn ? "Checked in ✓" : reg.status} />
              </div>

              <div className="flex flex-col items-center justify-center">
                {reg.qrCode ? (
                  <>
                    <div className="rounded-2xl overflow-hidden p-2" style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reg.qrCode} alt="Ticket QR code" style={{ width: 170, height: 170, display: "block" }} />
                    </div>
                    <p style={{ fontFamily: "monospace", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-1)", marginTop: "0.7rem", letterSpacing: "0.06em" }}>
                      {reg.ticketNumber}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.2rem", textAlign: "center" }}>
                      Show this code at the entrance
                    </p>
                  </>
                ) : (
                  <div className="text-center p-5 rounded-2xl" style={{ background: notIssued ? "#FEF3C7" : "var(--surface)" }}>
                    <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>{notIssued ? "⏳" : "🎫"}</div>
                    <p className="font-bold" style={{ fontSize: "0.85rem", color: notIssued ? "#92400E" : "var(--text-1)" }}>
                      {notIssued ? "Ticket not issued yet" : "No QR code on this ticket"}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: notIssued ? "#92400E" : "var(--text-3)", marginTop: "0.3rem", lineHeight: 1.6 }}>
                      {notIssued
                        ? "Your registration is awaiting approval (or payment). The QR code appears here the moment it is confirmed."
                        : "Contact the organiser."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-7 py-5" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Venue" value={[event.venue, event.city].filter(Boolean).join(", ") || "TBD"} />
              <Field label="Amount paid" value={formatCurrency(parseFloat(reg.amountPaid ?? "0"))} />
              <Field label="Payment" value={reg.paymentStatus} />
              <Field label="Reference" value={payment?.reference ?? "—"} />
            </div>
            {payment && payment.status !== "successful" && (
              <div className="mt-4">
                <Link href={`/pay/${payment.reference}`} className="btn btn-primary btn-sm no-print">Complete payment →</Link>
              </div>
            )}
          </div>
        </div>

        {event.customConfirmationMessage && (
          <div className="card p-5 mt-5">
            <p className="font-bold mb-2" style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>From the organiser</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>{event.customConfirmationMessage}</p>
          </div>
        )}

        {event.refundPolicy && (
          <div className="rounded-2xl p-5 mt-5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <p className="font-bold mb-2" style={{ fontSize: "0.85rem", color: "#92400E" }}>↩️ Refund policy</p>
            <p style={{ fontSize: "0.83rem", color: "#78350F", lineHeight: 1.7 }}>{event.refundPolicy}</p>
          </div>
        )}

        <p className="text-center mt-6 no-print" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
          Issued by UEB — Unique Events Booking · {formatDateTime(new Date())}
        </p>
      </div>

      <style jsx global>{`
        @media print {
          .no-print, header { display: none !important; }
          .print-surface { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="label-caps" style={{ color: "var(--text-3)", fontSize: "0.62rem" }}>{label}</p>
      <p style={{ fontSize: strong ? "0.95rem" : "0.85rem", fontWeight: strong ? 800 : 600, color: "var(--text-1)", marginTop: "0.15rem", wordBreak: "break-word" }}>
        {value}
      </p>
    </div>
  );
}
