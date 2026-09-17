"use client";
import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";

type Result = {
  success: boolean; status?: string; message: string;
  attendeeName?: string; attendeeEmail?: string; ticketType?: string;
  ticketNumber?: string; checkedInAt?: string;
  seatLabel?: string | null; slotLabel?: string | null; checkedInCount?: number;
};

const RESULT_META: Record<string, { bg: string; border: string; icon: string; heading: string }> = {
  VALID:        { bg:"#ECFDF5", border:"#6EE7B7", icon:"✅", heading:"VALID — Entry Allowed" },
  ALREADY_USED: { bg:"#FFFBEB", border:"#FCD34D", icon:"⚠️", heading:"ALREADY SCANNED" },
  PENDING:      { bg:"#EFF6FF", border:"#93C5FD", icon:"⏳", heading:"PENDING APPROVAL" },
  UNPAID:       { bg:"#FFF7ED", border:"#FDBA74", icon:"💳", heading:"PAYMENT OUTSTANDING" },
  INVALID:      { bg:"#FEF2F2", border:"#FCA5A5", icon:"❌", heading:"INVALID — Entry Denied" },
};

export default function CheckInPage() {
  const [code, setCode]     = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const verify = async (val: string) => {
    if (!val.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/checkin", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ticketNumber: val.trim().toUpperCase() }),
      });
      const data = await res.json();
      setResult(data);
      setRecent(prev => [data, ...prev.slice(0, 14)]);
    } catch {
      setResult({ success:false, message:"Network error. Please try again." });
    } finally {
      setLoading(false); setCode("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const meta = result ? (RESULT_META[result.status ?? (result.success?"VALID":"INVALID")] ?? RESULT_META.INVALID) : null;

  return (
    <div style={{ background:"var(--surface)", minHeight:"100dvh" }}>
      <Navbar />

      {/* Header */}
      <div
        className="relative overflow-hidden pt-28 pb-12"
        style={{ background:"linear-gradient(160deg, #0A0A0F 0%, #1C1C2E 50%, #2D1B69 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:`linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)`,
            backgroundSize:"50px 50px",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-5 sm:px-8 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl" style={{ background:"rgba(124,58,237,0.25)", backdropFilter:"blur(8px)", border:"1px solid rgba(124,58,237,0.4)" }}>
            📱
          </div>
          <p className="label-caps mb-3" style={{ color:"rgba(167,139,250,0.8)" }}>Event Staff</p>
          <h1 className="display-2 text-white mb-3">Ticket Check-In</h1>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.95rem" }}>
            Enter a ticket number or scan a QR code to verify and admit attendees
          </p>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-12" style={{ background:"linear-gradient(to bottom,transparent,var(--surface))" }} />
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-6">

        {/* Input card */}
        <div className="card p-6">
          <label className="block font-bold mb-3" style={{ fontSize:"0.9rem", color:"var(--text-1)" }}>
            Ticket Number / QR Code
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" stroke="var(--text-3)" strokeWidth="1.4"/>
                  <rect x="11" y="1" width="6" height="6" rx="1" stroke="var(--text-3)" strokeWidth="1.4"/>
                  <rect x="1" y="11" width="6" height="6" rx="1" stroke="var(--text-3)" strokeWidth="1.4"/>
                  <path d="M11 11h2v2h-2zM15 11h2M11 15v2M15 15h2v2h-2M15 13v1" stroke="var(--text-3)" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==="Enter" && verify(code)}
                placeholder="UEB-XXXXXXXX"
                className="input"
                style={{ paddingLeft:"3rem", fontFamily:"monospace", fontSize:"1rem", fontWeight:700, letterSpacing:"0.05em" }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <button
              onClick={() => verify(code)}
              disabled={loading || !code.trim()}
              className="btn btn-primary"
              style={{ minWidth:100, opacity: loading||!code.trim() ? 0.6 : 1 }}
            >
              {loading ? (
                <svg className="anim-spin-slow" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                  <path d="M9 2a7 7 0 0 1 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : "Verify"}
            </button>
          </div>
          <p style={{ fontSize:"0.75rem", color:"var(--text-3)", marginTop:"0.65rem" }}>
            Press <kbd style={{ background:"var(--surface-2)", padding:"0.1rem 0.4rem", borderRadius:"4px", fontFamily:"monospace", fontSize:"0.75rem" }}>Enter</kbd> to verify instantly
          </p>
        </div>

        {/* Result */}
        {result && meta && (
          <div
            className="anim-scaleIn rounded-2xl p-6 border-2"
            style={{ background:meta.bg, borderColor:meta.border }}
          >
            <div className="flex items-start gap-5">
              <div style={{ fontSize:"3.5rem", lineHeight:1, flexShrink:0 }}>{meta.icon}</div>
              <div className="flex-1">
                <h3 className="font-black mb-1" style={{ fontSize:"1.25rem", letterSpacing:"-0.02em", color:"var(--ink)" }}>{meta.heading}</h3>
                <p className="font-medium" style={{ color:"var(--text-2)", fontSize:"0.9rem", marginBottom:result.attendeeName?"1rem":"0" }}>{result.message}</p>
                {result.attendeeName && (
                  <div
                    className="rounded-xl p-4 space-y-1.5"
                    style={{ background:"rgba(255,255,255,0.6)", backdropFilter:"blur(8px)" }}
                  >
                    {[
                      { l:"Attendee", v:result.attendeeName },
                      result.attendeeEmail && { l:"Email", v:result.attendeeEmail },
                      result.ticketType && { l:"Ticket Type", v:result.ticketType },
                      result.ticketNumber && { l:"Ticket Ref", v:result.ticketNumber },
                      result.seatLabel && { l:"Seat", v:result.seatLabel },
                      result.slotLabel && { l:"Time Slot", v:result.slotLabel },
                      typeof result.checkedInCount === "number" && { l:"Admitted", v:`${result.checkedInCount} so far` },
                    ].filter(Boolean).map((row,i) => row && (
                      <div key={i} className="flex items-center gap-2">
                        <span style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--text-3)", minWidth:80 }}>{row.l}</span>
                        <span style={{ fontSize:"0.85rem", fontWeight:600, color:"var(--text-1)", fontFamily:row.l==="Ticket Ref"?"monospace":"inherit" }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent scans */}
        {recent.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ fontSize:"0.95rem", color:"var(--text-1)" }}>Recent Scans</h3>
              <span className="badge badge-violet">{recent.length} scans</span>
            </div>
            <div className="space-y-2">
              {recent.map((r, i) => {
                const rm = RESULT_META[r.status??(r.success?"VALID":"INVALID")] ?? RESULT_META.INVALID;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ background:rm.bg, borderColor:rm.border }}
                  >
                    <span style={{ fontSize:"1.25rem", flexShrink:0 }}>{rm.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate" style={{ fontSize:"0.82rem", color:"var(--text-1)" }}>{r.attendeeName ?? "Unknown"}</p>
                      <p className="truncate" style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>{r.message}</p>
                    </div>
                    <span style={{ fontSize:"0.7rem", fontWeight:700, color:"var(--text-3)", flexShrink:0 }}>
                      {r.status ?? (r.success?"VALID":"FAIL")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Guide */}
        <div className="card p-6" style={{ background:"var(--violet-bg)", border:"1px solid var(--violet-rim)" }}>
          <h4 className="font-bold mb-4" style={{ fontSize:"0.9rem", color:"var(--violet-low)" }}>📋 Staff Check-In Guide</h4>
          <ol className="space-y-2.5 mb-5">
            {[
              "Ask attendee to display their QR code or ticket number",
              "Enter the ticket number (format: UEB-XXXXXXXX) above",
              "Press Enter or click Verify",
              "System confirms validity and admits or denies entry",
            ].map((step,i)=>(
              <li key={i} className="flex items-start gap-3" style={{ fontSize:"0.82rem", color:"var(--violet-low)" }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center font-black text-xs shrink-0" style={{ background:"var(--violet-mid)", color:"#fff", marginTop:"0.05rem" }}>{i+1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-3 gap-2">
            {[
              { k:"VALID", bg:"#D1FAE5", c:"#065F46", desc:"Allow entry" },
              { k:"ALREADY USED", bg:"#FEF3C7", c:"#92400E", desc:"Already scanned" },
              { k:"INVALID", bg:"#FEE2E2", c:"#991B1B", desc:"Deny entry" },
              { k:"UNPAID", bg:"#FFEDD5", c:"#9A3412", desc:"Send to payments" },
            ].map(s=>(
              <div key={s.k} className="rounded-xl p-3 text-center" style={{ background:s.bg }}>
                <p className="font-black text-xs mb-1" style={{ color:s.c }}>{s.k}</p>
                <p style={{ fontSize:"0.68rem", color:s.c, opacity:0.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
