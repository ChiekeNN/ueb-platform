"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useSession } from "@/components/SessionProvider";

/**
 * Sign in.
 *
 * `?next=` is honoured only when it is a path on this site (starts with a
 * single "/"), so a crafted link cannot bounce someone to another domain after
 * they authenticate.
 */
function safeNext(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign you in");

      const fresh = await session.refresh();
      router.push(safeNext(params.get("next"), fresh.canAccessDashboard ? "/dashboard" : "/become-organiser"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  };

  const useDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError("");
  };

  return (
    <div className="card p-7 sm:p-8 max-w-md w-full anim-fadeUp">
      <h1 className="heading-2 mb-1" style={{ fontSize: "1.5rem" }}>Sign in</h1>
      <p className="mb-6" style={{ fontSize: "0.86rem", color: "var(--text-3)" }}>
        Access your dashboard, tickets and notifications.
      </p>

      {error && (
        <p
          className="rounded-xl px-4 py-3 mb-5 font-semibold"
          style={{ background: "#FEE2E2", color: "#991B1B", fontSize: "0.82rem" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center" style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
        New to UEB?{" "}
        <Link href="/signup" className="font-bold" style={{ color: "var(--violet-mid)" }}>Create an account</Link>
      </p>

      <div className="mt-6 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="label-caps mb-3" style={{ color: "var(--text-3)" }}>Demo accounts (after loading demo data)</p>
        <div className="space-y-2">
          {[
            { email: "admin@ueb.ng", role: "Platform admin" },
            { email: "chidi@upec.edu.ng", role: "Approved organiser" },
            { email: "tunde@naijabiz.ng", role: "Organiser application pending" },
          ].map((demo) => (
            <button
              key={demo.email}
              type="button"
              onClick={() => useDemo(demo.email)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors"
              style={{ background: "var(--surface)", fontSize: "0.78rem" }}
            >
              <span className="font-semibold" style={{ color: "var(--text-1)" }}>{demo.email}</span>
              <span style={{ color: "var(--text-3)" }}>{demo.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-3" style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
          Password for every demo account: <code className="font-bold">demo1234</code>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
      <Navbar />
      <div className="flex items-center justify-center px-5 pt-28 pb-16">
        <Suspense fallback={<div className="card p-8 max-w-md w-full" style={{ color: "var(--text-3)" }}>Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
