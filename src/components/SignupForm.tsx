"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Navbar from "@/components/Navbar";

type SignupRole = "admin" | "organizer" | "subscriber";
const CONFIG: Record<SignupRole, { label: string; title: string; note: string; icon: string }> = {
  admin: { label: "Platform admin", title: "Request an admin account", note: "Admin accounts are reviewed before they can access platform controls.", icon: "🛡️" },
  organizer: { label: "Event organiser", title: "Create your organiser account", note: "An admin must approve organiser accounts before they can publish events.", icon: "🗓️" },
  subscriber: { label: "Subscriber", title: "Join UEB as a subscriber", note: "Subscriber accounts can discover events, save events and keep tickets together.", icon: "🎟️" },
};

export default function SignupForm({ role }: { role: SignupRole }) {
  const config = CONFIG[role];
  const [form, setForm] = useState({ name: "", email: "", organisation: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, organisation: form.organisation, password: form.password, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create account");
      if (data.user && !data.pendingApproval) {
        localStorage.setItem("ueb.session", JSON.stringify({ role, email: form.email, status: "approved" }));
        window.dispatchEvent(new Event("ueb:session-changed"));
        window.location.assign("/subscriber");
        return;
      }
      setDone(data.message ?? "Your account request has been received.");
      setForm({ name: "", email: "", organisation: "", password: "", confirm: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <span className="badge badge-violet mb-5">{config.icon} {config.label}</span>
            <h1 className="display-2" style={{ color: "var(--text-1)" }}>{config.title}</h1>
            <p className="mt-5" style={{ color: "var(--text-3)", maxWidth: 480, lineHeight: 1.75 }}>{config.note}</p>
            <Link href="/login" className="btn btn-outline mt-7">Already have an account?</Link>
          </div>

          <form onSubmit={submit} className="card p-6 sm:p-8" style={{ boxShadow: "var(--shadow-lg)" }}>
            <h2 className="heading-2" style={{ color: "var(--text-1)" }}>Create account</h2>
            <p className="mt-1 mb-6" style={{ color: "var(--text-3)", fontSize: "0.82rem" }}>Fields marked with * are required.</p>
            {error && <div className="mb-4 p-3 rounded-xl" style={{ background: "#FEE2E2", color: "#991B1B", fontSize: "0.78rem" }}>{error}</div>}
            {done && <div className="mb-4 p-3 rounded-xl" style={{ background: "#D1FAE5", color: "#065F46", fontSize: "0.78rem", lineHeight: 1.5 }}>{done} <Link href="/login" style={{ fontWeight: 800, textDecoration: "underline" }}>Go to sign in.</Link></div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label><span className="field-label">Full name *</span><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ada Okafor" /></label>
              <label><span className="field-label">Email address *</span><input className="input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ada@example.com" /></label>
            </div>
            {role !== "subscriber" && <label className="block mt-4"><span className="field-label">Organisation</span><input className="input" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="Your organisation or company" /></label>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <label><span className="field-label">Password *</span><input className="input" required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
              <label><span className="field-label">Confirm password *</span><input className="input" required minLength={8} type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" /></label>
            </div>
            <button className="btn btn-primary w-full justify-center mt-6" disabled={busy} style={{ opacity: busy ? 0.65 : 1 }}>{busy ? "Creating account…" : `Create ${config.label.toLowerCase()} account`}</button>
            <p className="text-center mt-4" style={{ color: "var(--text-3)", fontSize: "0.7rem", lineHeight: 1.5 }}>By continuing, you agree to use UEB responsibly. Organiser and admin access is subject to approval.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
