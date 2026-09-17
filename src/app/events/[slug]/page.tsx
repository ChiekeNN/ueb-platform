"use client";
import { useState, useEffect, use } from "react";
import Navbar from "@/components/Navbar";
import { formatDateTime, formatDate, formatTime, formatCurrency, calculateUEBFee, getStatusColor, EVENT_CATEGORIES } from "@/lib/utils";
import Link from "next/link";

type Ev = {
  id: string; title: string; slug: string; description?: string | null;
  category?: string | null; type?: string | null; status?: string | null;
  startDate?: string | null; endDate?: string | null;
  venue?: string | null; city?: string | null; country?: string | null; address?: string | null;
  imageUrl?: string | null; bannerColor?: string | null;
  capacity?: number | null; totalRegistrations?: number | null; totalCheckins?: number | null;
  totalRevenue?: string | null; requiresApproval?: boolean | null;
  refundPolicy?: string | null; customConfirmationMessage?: string | null;
  feeAbsorbedByOrganiser?: boolean | null;
  customQuestions?: { id: string; label: string; type: string; required: boolean; options?: string[] }[];
};
type Tier = { id: string; name: string; type: string; price: string; quantity?: number | null; quantitySold?: number | null; description?: string | null };
type Org  = { name: string; email: string; organisation?: string | null };
type Stats= { totalRegistrations: number; approved: number; pending: number; checkedIn: number; totalRevenue: number };

const CAT_ICONS: Record<string,string> = {
  conference:"🎤",seminar:"📚",workshop:"🔧",concert:"🎸",corporate:"💼",university:"🎓",
  church:"⛪",government:"🏛️",wedding:"💍",networking:"🤝",training:"📋",exhibition:"🖼️",
  fundraising:"💝",private:"🔒",other:"🎪",
};

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [ev, setEv] = useState<Ev | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selTier, setSelTier] = useState<Tier | null>(null);
  const [success, setSuccess] = useState<{ ticketNumber: string; qrCode: string; requiresApproval: boolean } | null>(null);
  const [regErr, setRegErr] = useState("");
  const [form, setForm] = useState({ attendeeName:"",attendeeEmail:"",attendeePhone:"",organisation:"",jobTitle:"",customAnswers:{} as Record<string,string> });

  useEffect(() => {
    fetch(`/api/events/${slug}`)
      .then(r => r.json())
      .then(d => {
        setEv(d.event); setTiers(d.tiers ?? []); setOrg(d.organiser); setStats(d.stats);
        if (d.tiers?.length > 0) setSelTier(d.tiers[0]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const register = async () => {
    if (!ev || !form.attendeeName || !form.attendeeEmail) { setRegErr("Name and email are required."); return; }
    setBusy(true); setRegErr("");
    try {
      const res = await fetch("/api/registrations", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ eventId:ev.id, ticketTierId:selTier?.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setSuccess({ ticketNumber: data.registration.ticketNumber, qrCode: data.registration.qrCode, requiresApproval: !!ev.requiresApproval });
      setShowForm(false);
    } catch(e:unknown) { setRegErr(e instanceof Error ? e.message : "Registration failed"); }
    finally { setBusy(false); }
  };

  if (loading) return (
    <div style={{ background:"var(--surface)", minHeight:"100dvh" }}>
      <Navbar />
      <div className="flex items-center justify-center" style={{ height:"80vh" }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 skeleton" />
          <div className="skeleton h-4 w-40 mx-auto mb-2" />
          <div className="skeleton h-3 w-28 mx-auto" />
        </div>
      </div>
    </div>
  );

  if (!ev) return (
    <div style={{ background:"var(--surface)", minHeight:"100dvh" }}><Navbar />
      <div className="flex items-center justify-center" style={{ height:"80vh" }}>
        <div className="text-center">
          <div style={{ fontSize:"4rem", marginBottom:"1rem" }}>😕</div>
          <h2 className="heading-2 mb-2" style={{ color:"var(--text-1)" }}>Event not found</h2>
          <Link href="/events" className="btn btn-primary mt-4">← Browse Events</Link>
        </div>
      </div>
    </div>
  );

  const catLabel = EVENT_CATEGORIES.find(c=>c.value===ev.category)?.label ?? ev.category;
  const catIcon  = CAT_ICONS[ev.category ?? "other"] ?? "🎪";
  const hasFree  = tiers.some(t => parseFloat(t.price??'0')===0);
  const pct = ev.capacity && ev.totalRegistrations ? Math.min(100, Math.round((ev.totalRegistrations/ev.capacity)*100)) : 0;

  return (
    <div style={{ background:"var(--surface)", minHeight:"100dvh" }}>
      <Navbar />

      {/* ── HERO BANNER ── */}
      <div
        className="relative overflow-hidden"
        style={{
          height: "clamp(260px, 35vh, 400px)",
          background: ev.imageUrl
            ? `url(${ev.imageUrl}) center/cover no-repeat`
            : `linear-gradient(145deg, ${ev.bannerColor??'#6D28D9'}, ${ev.bannerColor??'#4C1D95'}88)`,
        }}
      >
        <div className="absolute inset-0" style={{ background:"linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%)" }} />

        {/* Back link */}
        <div className="absolute top-20 left-6">
          <Link href="/events" className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-white text-sm font-medium">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Events
          </Link>
        </div>

        <div className="absolute bottom-8 left-6 right-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge glass text-white/90 border-white/20" style={{ background:"rgba(0,0,0,0.3)" }}>
              {catIcon} {catLabel}
            </span>
            {ev.status && ev.status !== "published" && (
              <span className={`badge ${getStatusColor(ev.status)}`}>{ev.status}</span>
            )}
          </div>
          <h1 className="display-2 text-white">{ev.title}</h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── LEFT ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { v: stats.totalRegistrations, l:"Registered", c:"var(--violet-mid)", icon:"👥" },
                  { v: stats.approved, l:"Approved", c:"var(--green)", icon:"✅" },
                  { v: stats.checkedIn, l:"Checked In", c:"#0891B2", icon:"📱" },
                  { v: formatCurrency(stats.totalRevenue), l:"Revenue", c:"#B45309", icon:"💰" },
                ].map(s => (
                  <div key={s.l} className="card p-4 text-center">
                    <div style={{ fontSize:"1.4rem", marginBottom:"0.25rem" }}>{s.icon}</div>
                    <div className="font-black" style={{ fontSize:"1.1rem", color:s.c, letterSpacing:"-0.02em" }}>{s.v}</div>
                    <div style={{ fontSize:"0.72rem", color:"var(--text-3)", fontWeight:600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* About */}
            <div className="card p-6">
              <h2 className="heading-2 mb-4" style={{ color:"var(--text-1)" }}>About this Event</h2>
              {ev.description
                ? <p style={{ color:"var(--text-2)", lineHeight:1.8, fontSize:"0.95rem", whiteSpace:"pre-line" }}>{ev.description}</p>
                : <p style={{ color:"var(--text-3)", fontStyle:"italic" }}>No description provided.</p>
              }
            </div>

            {/* Event details */}
            <div className="card p-6">
              <h2 className="heading-2 mb-5" style={{ color:"var(--text-1)" }}>Event Details</h2>
              <div className="space-y-4">
                {ev.startDate && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background:"var(--violet-bg)" }}>📅</div>
                    <div>
                      <p className="font-bold text-sm" style={{ color:"var(--text-1)" }}>{formatDate(ev.startDate)} at {formatTime(ev.startDate)}</p>
                      {ev.endDate && <p style={{ fontSize:"0.8rem", color:"var(--text-3)", marginTop:"0.15rem" }}>Ends: {formatDateTime(ev.endDate)}</p>}
                    </div>
                  </div>
                )}
                {(ev.venue||ev.city) && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background:"var(--violet-bg)" }}>📍</div>
                    <div>
                      {ev.venue && <p className="font-bold text-sm" style={{ color:"var(--text-1)" }}>{ev.venue}</p>}
                      <p style={{ fontSize:"0.8rem", color:"var(--text-3)", marginTop:"0.15rem" }}>{[ev.address,ev.city,ev.country].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                )}
                {ev.capacity && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background:"var(--violet-bg)" }}>👥</div>
                    <div className="flex-1">
                      <p className="font-bold text-sm mb-2" style={{ color:"var(--text-1)" }}>
                        {ev.totalRegistrations??0} of {ev.capacity} spots filled {pct>=80 && <span className="badge badge-red ml-1">Almost Full</span>}
                      </p>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width:`${pct}%`, background: pct>=80?"linear-gradient(90deg,#DC2626,#EF4444)":"linear-gradient(90deg,var(--violet),var(--violet-hi))" }}/>
                      </div>
                    </div>
                  </div>
                )}
                {ev.requiresApproval && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background:"#FEF3C7" }}>✅</div>
                    <div className="flex items-center">
                      <p style={{ fontSize:"0.85rem", color:"var(--text-2)" }}>Registration requires organiser approval</p>
                    </div>
                  </div>
                )}
                {org && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background:"var(--surface-2)" }}>🏢</div>
                    <div>
                      <p className="font-bold text-sm" style={{ color:"var(--text-1)" }}>{org.organisation??org.name}</p>
                      <p style={{ fontSize:"0.8rem", color:"var(--text-3)", marginTop:"0.1rem" }}>{org.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Refund policy */}
            {ev.refundPolicy && (
              <div className="rounded-2xl p-5" style={{ background:"#FFFBEB", border:"1px solid #FDE68A" }}>
                <p className="font-bold mb-2" style={{ fontSize:"0.85rem", color:"#92400E" }}>↩️ Refund Policy</p>
                <p style={{ fontSize:"0.85rem", color:"#78350F", lineHeight:1.7 }}>{ev.refundPolicy}</p>
              </div>
            )}

            {/* Organiser actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard`} className="btn btn-dark justify-center">Manage Event →</Link>
              <Link href={`/checkin?event=${ev.id}`} className="btn btn-outline justify-center">📱 Check-In</Link>
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-20">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold" style={{ fontSize:"1rem", color:"var(--text-1)" }}>Register</h3>
                <span className={`badge ${getStatusColor(ev.status??"published")}`}>{ev.status}</span>
              </div>

              {/* Ticket tiers */}
              {!success && (
                <div className="space-y-2 mb-5">
                  {tiers.map(t => {
                    const price = parseFloat(t.price??'0');
                    const fee   = price>0 ? calculateUEBFee(price) : 0;
                    const total = ev.feeAbsorbedByOrganiser ? price : price+fee;
                    const full  = !!(t.quantity && t.quantitySold && t.quantitySold>=t.quantity);
                    return (
                      <button
                        key={t.id} onClick={()=>!full&&setSelTier(t)} disabled={full}
                        className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200"
                        style={{
                          borderColor: selTier?.id===t.id ? "var(--violet-mid)" : "var(--border)",
                          background: selTier?.id===t.id ? "var(--violet-bg)" : "#fff",
                          opacity: full ? 0.5 : 1,
                          cursor: full ? "not-allowed" : "pointer",
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate" style={{ color:"var(--text-1)" }}>{t.name}</p>
                            {t.description && <p style={{ fontSize:"0.72rem", color:"var(--text-3)", marginTop:"0.15rem" }}>{t.description}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              {t.quantity && (
                                <span style={{ fontSize:"0.7rem", color:full?"var(--red)":"var(--text-3)", fontWeight:600 }}>
                                  {full?"Sold Out":`${t.quantity-(t.quantitySold??0)} left`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black" style={{ fontSize:"0.95rem", color:"var(--text-1)", letterSpacing:"-0.02em" }}>
                              {price===0?"Free":formatCurrency(total)}
                            </p>
                            {price>0 && !ev.feeAbsorbedByOrganiser && (
                              <p style={{ fontSize:"0.68rem", color:"var(--text-3)" }}>incl. ₦{fee.toLocaleString()} fee</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Success state */}
              {success ? (
                <div className="text-center anim-scaleIn">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 text-3xl"
                    style={{ background: success.requiresApproval ? "#FEF3C7" : "#D1FAE5" }}
                  >
                    {success.requiresApproval ? "⏳" : "🎉"}
                  </div>
                  <h4 className="font-black mb-1" style={{ color:success.requiresApproval?"#92400E":"var(--green)", fontSize:"1.1rem" }}>
                    {success.requiresApproval ? "Registration Submitted!" : "You're Registered!"}
                  </h4>
                  {success.requiresApproval
                    ? <p style={{ fontSize:"0.82rem", color:"var(--text-3)", marginBottom:"1rem" }}>Your registration is pending organiser approval.</p>
                    : <p style={{ fontSize:"0.82rem", color:"var(--text-3)", marginBottom:"1rem" }}>Ticket: <strong>{success.ticketNumber}</strong></p>
                  }
                  {ev.customConfirmationMessage && (
                    <div className="rounded-xl p-3 mb-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                      <p style={{ fontSize:"0.78rem", color:"var(--text-2)", lineHeight:1.6 }}>{ev.customConfirmationMessage}</p>
                    </div>
                  )}
                  {success.qrCode && (
                    <div className="flex justify-center mb-3">
                      <div className="rounded-2xl overflow-hidden p-2" style={{ background:"#fff", border:"1px solid var(--border)", boxShadow:"var(--shadow-md)" }}>
                        <img src={success.qrCode} alt="QR Code" style={{ width:140, height:140, display:"block" }} />
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>Show this QR code at the venue entrance</p>
                </div>

              /* Form state */
              ) : showForm ? (
                <div className="space-y-3 anim-fadeUp">
                  {regErr && (
                    <div className="p-3 rounded-xl flex items-center gap-2" style={{ background:"#FEE2E2", border:"1px solid #FECACA" }}>
                      <span style={{ color:"var(--red)" }}>⚠</span>
                      <p style={{ fontSize:"0.78rem", color:"#991B1B" }}>{regErr}</p>
                    </div>
                  )}
                  {[
                    { f:"attendeeName",  ph:"Full Name *",      type:"text" },
                    { f:"attendeeEmail", ph:"Email Address *",  type:"email" },
                    { f:"attendeePhone", ph:"Phone Number",     type:"tel" },
                    { f:"organisation",  ph:"Organisation",     type:"text" },
                    { f:"jobTitle",      ph:"Job Title / Role", type:"text" },
                  ].map(inp => (
                    <input
                      key={inp.f} type={inp.type} placeholder={inp.ph}
                      value={form[inp.f as keyof typeof form] as string}
                      onChange={e => setForm(x => ({ ...x, [inp.f]: e.target.value }))}
                      className="input"
                      style={{ fontSize:"0.85rem", padding:"0.65rem 1rem" }}
                    />
                  ))}
                  {ev.customQuestions?.map(q => (
                    <div key={q.id}>
                      <label className="block font-semibold mb-1" style={{ fontSize:"0.75rem", color:"var(--text-2)" }}>{q.label}{q.required?" *":""}</label>
                      {q.type==="dropdown"&&q.options
                        ? <select onChange={e=>setForm(x=>({...x,customAnswers:{...x.customAnswers,[q.id]:e.target.value}}))} className="input" style={{ fontSize:"0.85rem" }}>
                            <option value="">Select…</option>
                            {q.options.map(o=><option key={o}>{o}</option>)}
                          </select>
                        : <input type={q.type==="email"?"email":q.type==="number"?"number":"text"}
                            onChange={e=>setForm(x=>({...x,customAnswers:{...x.customAnswers,[q.id]:e.target.value}}))}
                            className="input" style={{ fontSize:"0.85rem" }} />
                      }
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={()=>setShowForm(false)} className="btn btn-outline flex-1" style={{ fontSize:"0.85rem" }}>Cancel</button>
                    <button onClick={register} disabled={busy} className="btn btn-primary flex-1" style={{ fontSize:"0.85rem", opacity:busy?0.7:1 }}>
                      {busy ? "Registering…" : "Complete Registration"}
                    </button>
                  </div>
                </div>

              /* CTA state */
              ) : (
                <>
                  <button
                    onClick={()=>setShowForm(true)}
                    className="btn btn-primary w-full justify-center"
                    style={{ fontSize:"0.95rem", padding:"0.9rem" }}
                  >
                    {hasFree ? "Register for Free" : `Get ${selTier?.name ?? "Tickets"}`}
                  </button>
                  <p className="text-center mt-3" style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>
                    {ev.requiresApproval ? "⏳ Requires organiser approval" : "✅ Instant confirmation"}
                  </p>
                </>
              )}
            </div>

            {/* Share card */}
            <div className="card p-4">
              <p className="font-bold mb-3" style={{ fontSize:"0.85rem", color:"var(--text-1)" }}>Share this Event</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "WhatsApp", icon: "💬", color: "#25D366", href: `https://wa.me/?text=${encodeURIComponent(ev.title)}` },
                  { label: "Twitter/X", icon: "✖️", color: "#000", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(ev.title)}` },
                ].map(s=>(
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold transition-all duration-200"
                    style={{ fontSize:"0.78rem", background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text-2)" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background="var(--violet-bg)";(e.currentTarget as HTMLAnchorElement).style.borderColor="var(--violet-rim)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background="var(--surface)";(e.currentTarget as HTMLAnchorElement).style.borderColor="var(--border)";}}
                  >
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
