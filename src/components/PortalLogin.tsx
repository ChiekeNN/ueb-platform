"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Navbar from "@/components/Navbar";

type PortalRole = "admin" | "organizer" | "subscriber";

const PORTALS: Record<PortalRole, { label: string; title: string; description: string; destination: string; icon: string; accent: string }> = {
  admin: {
    label: "Platform admin",
    title: "Run the UEB platform",
    description: "Review activity, manage organisers and keep the event marketplace healthy.",
    destination: "/admin",
    icon: "🛡️",
    accent: "#7C3AED",
  },
  organizer: {
    label: "Event organiser",
    title: "Welcome back, organiser",
    description: "Create events, review guests, sell tickets and run every event from one workspace.",
    destination: "/organizer",
    icon: "🗓️",
    accent: "#0891B2",
  },
  subscriber: {
    label: "Subscriber",
    title: "Keep your events close",
    description: "Find events, save the ones you love and keep your tickets in one place.",
    destination: "/subscriber",
    icon: "🎟️",
    accent: "#059669",
  },
};

export default function PortalLogin({ role }: { role: PortalRole }) {
  const portal = PORTALS[role];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    // This keeps the portal usable for product demos while real auth is wired
    // to Supabase Auth or the production identity provider.
    window.localStorage.setItem("ueb.session", JSON.stringify({ role, email: email || `demo@${role}.ueb.ng`, signedInAt: new Date().toISOString() }));
    window.setTimeout(() => window.location.assign(portal.destination), 250);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <div>
            <span className="badge badge-violet mb-5">{portal.icon} {portal.label}</span>
            <h1 className="display-2" style={{ color: "var(--text-1)" }}>{portal.title}</h1>
            <p className="mt-5" style={{ color: "var(--text-3)", maxWidth: 500, fontSize: "1rem", lineHeight: 1.75 }}>{portal.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
              {[
                ["One account", "Your activity stays in UEB"],
                ["Secure flow", "Tickets and records in one place"],
                ["Always local", "Built for African events"],
              ].map(([title, copy]) => (
                <div key={title} className="p-4 rounded-2xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-1)" }}>{title}</p>
                  <p className="mt-1" style={{ fontSize: "0.72rem", color: "var(--text-3)", lineHeight: 1.5 }}>{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={signIn} className="card p-6 sm:p-8" style={{ boxShadow: "var(--shadow-lg)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5" style={{ background: `${portal.accent}18` }}>{portal.icon}</div>
            <h2 className="heading-2" style={{ color: "var(--text-1)" }}>Sign in to UEB</h2>
            <p className="mt-1 mb-6" style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Use your email and password to continue.</p>

            <label className="block mb-4">
              <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "0.4rem" }}>Email address</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${role}.com`} autoComplete="email" />
            </label>
            <label className="block mb-5">
              <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "0.4rem" }}>Password</span>
              <input className="input" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
            </label>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy} style={{ opacity: busy ? 0.65 : 1 }}>
              {busy ? "Opening workspace…" : `Continue as ${portal.label}`}
            </button>
            <p className="text-center mt-5" style={{ fontSize: "0.72rem", color: "var(--text-3)", lineHeight: 1.6 }}>
              Demo access is enabled for this preview. Production authentication can be connected to Supabase Auth without changing the portal screens.
            </p>
          </form>
        </div>

        <div className="text-center mt-8">
          <Link href="/login" style={{ color: "var(--violet-mid)", fontSize: "0.82rem", fontWeight: 700 }}>← Choose another account type</Link>
        </div>
      </main>
    </div>
  );
}
