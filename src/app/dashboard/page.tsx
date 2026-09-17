"use client";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import CreateEventLink from "@/components/CreateEventLink";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, EVENT_CATEGORIES } from "@/lib/utils";

type Event = {
  id: string; title: string; slug: string; status: string; category: string;
  startDate: string | null; city: string | null; venue: string | null;
  totalRegistrations: number; totalCheckins: number; totalRevenue: string;
  capacity: number | null; bannerColor: string;
};
type Reg = {
  id: string; attendeeName: string; attendeeEmail: string; attendeePhone: string | null;
  organisation: string | null; jobTitle: string | null; status: string; paymentStatus: string;
  amountPaid: string; ticketNumber: string | null; checkedIn: boolean; checkedInAt: string | null;
  createdAt: string;
};

const STATUS_TABS = [
  { value: "all",      label: "All" },
  { value: "pending",  label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold",  label: "On Hold" },
];

export default function DashboardPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [sel, setSel]         = useState<Event | null>(null);
  const [regs, setRegs]       = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [regLoad, setRegLoad] = useState(false);
  const [filter, setFilter]   = useState("all");
  const [seeding, setSeeding] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast]     = useState<{ msg: string; type: "ok"|"err" } | null>(null);

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events?status=all");
      const data = await res.json();
      setDemoMode(Boolean(data.demo));
      setEvents(data.events ?? []);
      if (data.events?.length > 0 && !sel) setSel(data.events[0]);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!sel) return;
    setRegLoad(true);
    fetch(`/api/registrations?eventId=${sel.id}`)
      .then(r => r.json())
      .then(d => setRegs(d.registrations ?? []))
      .finally(() => setRegLoad(false));
  }, [sel]);

  const updStatus = async (id: string, status: string) => {
    await fetch(`/api/registrations/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });
    setRegs(rs => rs.map(r => r.id===id ? {...r,status} : r));
    showToast(`Registration ${status}`);
  };

  const togglePublish = async (ev: Event) => {
    const newStatus = ev.status==="published" ? "draft" : "published";
    await fetch(`/api/events/${ev.slug}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status:newStatus }) });
    setEvents(es => es.map(e => e.id===ev.id ? {...e,status:newStatus} : e));
    if (sel?.id===ev.id) setSel(s => s ? {...s,status:newStatus} : s);
    showToast(`Event ${newStatus}`);
  };

  const deleteEv = async (ev: Event) => {
    if (!confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    await fetch(`/api/events/${ev.slug}`, { method:"DELETE" });
    setEvents(es => es.filter(e => e.id!==ev.id));
    if (sel?.id===ev.id) { setSel(null); setRegs([]); }
    showToast("Event deleted", "err");
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method:"POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(result.error ?? "Connect PostgreSQL before seeding", "err");
        return;
      }
      await fetchEvents();
      showToast("Database connected and demo events loaded!");
    } catch {
      showToast("Connect PostgreSQL before seeding", "err");
    } finally {
      setSeeding(false);
    }
  };

  const filtered = filter==="all" ? regs : regs.filter(r => r.status===filter);

  const stats = {
    total: regs.length,
    approved: regs.filter(r=>r.status==="approved").length,
    pending: regs.filter(r=>r.status==="pending").length,
    checkedIn: regs.filter(r=>r.checkedIn).length,
    revenue: regs.filter(r=>r.paymentStatus==="paid").reduce((s,r) => s+parseFloat(r.amountPaid||"0"), 0),
    noShow: regs.filter(r=>r.status==="approved"&&!r.checkedIn).length,
  };

  const attendRate = stats.approved > 0 ? Math.round((stats.checkedIn / stats.approved) * 100) : 0;

  return (
    <div style={{ background:"var(--surface)", minHeight:"100dvh" }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 anim-scaleIn px-5 py-3 rounded-2xl font-semibold text-sm flex items-center gap-2"
          style={{ background: toast.type==="ok" ? "var(--ink)" : "#DC2626", color:"#fff", boxShadow:"var(--shadow-xl)" }}
        >
          {toast.type==="ok" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="pt-20 pb-0" style={{ borderBottom:"1px solid var(--border)", background:"#fff" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-caps mb-1" style={{ color:"var(--violet-mid)" }}>Organiser</p>
              <h1 className="heading-1" style={{ color:"var(--text-1)" }}>Event Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              {(events.length === 0 || demoMode) && (
                <button onClick={seed} disabled={seeding} className="btn btn-outline btn-sm" style={{ opacity:seeding?0.6:1 }}>
                  {seeding ? "Setting up…" : demoMode ? "Seed database" : "Load Demo Data"}
                </button>
              )}
              <CreateEventLink href="/events/create" className="btn btn-primary">+ Create Event</CreateEventLink>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              {[1,2,3].map(i=><div key={i} className="skeleton h-28 rounded-2xl"/>)}
            </div>
            <div className="lg:col-span-2 skeleton rounded-2xl" style={{ minHeight:400 }}/>
          </div>
        ) : events.length===0 ? (
          <div className="card text-center py-24 px-8">
            <div style={{ fontSize:"4rem", marginBottom:"1rem", opacity:0.3 }}>📋</div>
            <h3 className="heading-2 mb-2" style={{ color:"var(--text-1)" }}>No events yet</h3>
            <p style={{ color:"var(--text-3)", marginBottom:"2rem", fontSize:"0.9rem" }}>Create your first event or load demo data to explore the dashboard</p>
            <div className="flex justify-center gap-3">
              <CreateEventLink href="/events/create" className="btn btn-primary">Create Event</CreateEventLink>
              <button onClick={seed} disabled={seeding} className="btn btn-outline" style={{ opacity:seeding?0.6:1 }}>
                {seeding?"Loading…":"Load Demo Data"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Event list ── */}
            <div className="space-y-2">
              <p className="label-caps mb-3 px-1" style={{ color:"var(--text-3)" }}>Your Events ({events.length})</p>
              <div className="space-y-2 max-h-screen overflow-y-auto no-scrollbar">
                {events.map(ev => (
                  <button
                    key={ev.id}
                    onClick={()=>{setSel(ev); setFilter("all");}}
                    className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200"
                    style={{
                      borderColor: sel?.id===ev.id ? "var(--violet-mid)" : "transparent",
                      background: sel?.id===ev.id ? "#fff" : "rgba(255,255,255,0.6)",
                      boxShadow: sel?.id===ev.id ? "var(--shadow-md)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div
                        className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-black text-white text-xs"
                        style={{ background:`linear-gradient(135deg,${ev.bannerColor??"#6D28D9"},${ev.bannerColor??"#4C1D95"}88)` }}
                      >
                        {ev.title.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate" style={{ fontSize:"0.85rem", color:"var(--text-1)" }}>{ev.title}</p>
                        <p style={{ fontSize:"0.72rem", color:"var(--text-3)", marginTop:"0.1rem" }}>
                          {ev.city??"—"} · {ev.startDate ? formatDate(ev.startDate) : "TBD"}
                        </p>
                      </div>
                      <span className={`badge shrink-0 ${getStatusColor(ev.status)}`}>{ev.status}</span>
                    </div>
                    <div className="flex gap-3 pl-11">
                      {[
                        { icon:"👥", v:ev.totalRegistrations },
                        { icon:"📱", v:ev.totalCheckins },
                        { icon:"💰", v:formatCurrency(parseFloat(ev.totalRevenue??'0')) },
                      ].map(s=>(
                        <span key={s.icon} style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>{s.icon} {s.v}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Right panel ── */}
            {sel && (
              <div className="lg:col-span-2 space-y-5">

                {/* Event actions header */}
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between mb-5 gap-4">
                    <div className="min-w-0">
                      <p className="label-caps mb-1" style={{ color:"var(--violet-mid)" }}>{EVENT_CATEGORIES.find(c=>c.value===sel.category)?.label}</p>
                      <h2 className="heading-2 truncate" style={{ color:"var(--text-1)" }}>{sel.title}</h2>
                      <p style={{ fontSize:"0.8rem", color:"var(--text-3)", marginTop:"0.2rem" }}>{sel.city} · {sel.startDate ? formatDate(sel.startDate):"TBD"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/events/${sel.slug}/manage`} className="btn btn-dark btn-sm" style={{ fontSize:"0.78rem" }}>⚙ Manage</Link>
                      <Link href={`/events/${sel.slug}`} className="btn btn-outline btn-sm" style={{ fontSize:"0.78rem" }}>View Page</Link>
                      <button onClick={()=>togglePublish(sel)} className="btn btn-sm" style={{ fontSize:"0.78rem", background:sel.status==="published"?"var(--surface-2)":"var(--violet-mid)", color:sel.status==="published"?"var(--text-1)":"#fff" }}>
                        {sel.status==="published"?"Unpublish":"Publish"}
                      </button>
                      <button onClick={()=>deleteEv(sel)} className="btn btn-sm" style={{ fontSize:"0.78rem", background:"#FEE2E2", color:"var(--red)" }}>Delete</button>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { icon:"📋", label:"Total",     v:stats.total,              c:"var(--violet-mid)" },
                      { icon:"✅", label:"Approved",  v:stats.approved,           c:"var(--green)" },
                      { icon:"⏳", label:"Pending",   v:stats.pending,            c:"var(--amber)" },
                      { icon:"📱", label:"Checked In",v:stats.checkedIn,          c:"#0891B2" },
                      { icon:"💰", label:"Revenue",   v:formatCurrency(stats.revenue), c:"#B45309" },
                      { icon:"📈", label:"Attend Rate",v:`${attendRate}%`,        c:attendRate>70?"var(--green)":"var(--amber)" },
                    ].map(s=>(
                      <div key={s.label} className="text-center p-3 rounded-xl" style={{ background:"var(--surface)" }}>
                        <div style={{ fontSize:"1.1rem" }}>{s.icon}</div>
                        <div className="font-black" style={{ fontSize:"0.95rem", color:s.c, letterSpacing:"-0.02em" }}>{s.v}</div>
                        <div style={{ fontSize:"0.65rem", color:"var(--text-3)", fontWeight:600, marginTop:"0.1rem" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Registrations */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold" style={{ fontSize:"1rem", color:"var(--text-1)" }}>Registrations</h3>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar min-w-0">
                      {STATUS_TABS.map(tab=>(
                        <button
                          key={tab.value}
                          onClick={()=>setFilter(tab.value)}
                          className="shrink-0 px-3 py-1.5 rounded-lg font-semibold transition-all duration-200"
                          style={{
                            fontSize:"0.75rem",
                            background: filter===tab.value ? "var(--violet-mid)" : "var(--surface)",
                            color: filter===tab.value ? "#fff" : "var(--text-2)",
                          }}
                        >
                          {tab.label}
                          {tab.value!=="all" && (
                            <span className="ml-1 opacity-70">
                              ({regs.filter(r=>tab.value==="all"||r.status===tab.value).length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {regLoad ? (
                    <div className="space-y-2">
                      {[1,2,3,4].map(i=><div key={i} className="skeleton h-16 rounded-xl"/>)}
                    </div>
                  ) : filtered.length===0 ? (
                    <div className="text-center py-12">
                      <div style={{ fontSize:"2.5rem", marginBottom:"0.75rem", opacity:0.3 }}>📭</div>
                      <p style={{ color:"var(--text-3)", fontSize:"0.85rem" }}>No {filter!=="all"?filter:""} registrations yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                      {filtered.map(reg=>(
                        <div
                          key={reg.id}
                          className="flex items-center gap-3 p-3.5 rounded-xl transition-colors duration-200"
                          style={{ background:"var(--surface)" }}
                          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="var(--surface-2)"}
                          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="var(--surface)"}
                        >
                          {/* Avatar */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                            style={{ background:`hsl(${reg.attendeeName.charCodeAt(0)*17%360},65%,90%)`, color:`hsl(${reg.attendeeName.charCodeAt(0)*17%360},65%,30%)` }}
                          >
                            {reg.attendeeName.charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate" style={{ fontSize:"0.85rem", color:"var(--text-1)" }}>{reg.attendeeName}</p>
                            <p className="truncate" style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>
                              {reg.attendeeEmail}
                              {reg.organisation && ` · ${reg.organisation}`}
                            </p>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2 shrink-0">
                            {reg.checkedIn && <span className="badge badge-green" style={{ fontSize:"0.65rem" }}>✓ In</span>}
                            {parseFloat(reg.amountPaid)>0 && (
                              <span style={{ fontSize:"0.72rem", color:"var(--text-3)", fontWeight:600 }}>
                                {formatCurrency(parseFloat(reg.amountPaid))}
                              </span>
                            )}
                            <span className={`badge ${getStatusColor(reg.status)}`} style={{ fontSize:"0.65rem" }}>{reg.status}</span>

                            {/* Action buttons for pending */}
                            {reg.status==="pending" && (
                              <div className="flex gap-1">
                                <button onClick={()=>updStatus(reg.id,"approved")} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors" style={{ background:"#D1FAE5", color:"#065F46" }} title="Approve">✓</button>
                                <button onClick={()=>updStatus(reg.id,"on_hold")} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors" style={{ background:"#FEF3C7", color:"#92400E" }} title="Hold">⏸</button>
                                <button onClick={()=>updStatus(reg.id,"rejected")} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors" style={{ background:"#FEE2E2", color:"#991B1B" }} title="Reject">✕</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Link href={`/events/${sel.slug}/manage`} className="btn btn-dark justify-center" style={{ fontSize:"0.85rem" }}>⚙ Manage</Link>
                  <Link href={`/events/${sel.slug}/report`} className="btn btn-outline justify-center" style={{ fontSize:"0.85rem" }}>🧾 Report</Link>
                  <Link href={`/checkin?event=${sel.id}&slug=${sel.slug}`} className="btn btn-primary justify-center" style={{ fontSize:"0.85rem" }}>📱 Check-In</Link>
                  <CreateEventLink href="/events/create" className="btn btn-outline justify-center" style={{ fontSize:"0.85rem" }}>＋ New Event</CreateEventLink>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
