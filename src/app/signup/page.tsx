"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useSession } from "@/components/SessionProvider";

/**
 * Create an account.
 *
 * Everyone starts as an attendee — browsing and registering for events needs no
 * approval. Ticking "I want to organise events" (or arriving from the nav's
 * "Become an organiser" button) files an application straight into the admin
 * approval queue, and only an admin can approve it.
 */
function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organisation: "",
    password: "",
    confirm: "",
  });
  const [wantsOrganiser, setWantsOrganiser] = useState(params.get("intent") === "organiser");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const upd = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          organisation: form.organisation,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create your account");

      await session.refresh();
      router.push(wantsOrganiser ? "/become-organiser?welcome=1" : "/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-7 sm:p-8 max-w-lg w-full anim-fadeUp">
      <h1 className="heading-2 mb-1" style={{ fontSize: "1.5rem" }}>Create your account</h1>
      <p className="mb-6" style={{ fontSize: "0.86rem", color: "var(--text-3)" }}>
        Free to join. Browsing and registering for events is instant — organising needs a quick admin approval.
      </p>

      {error && (
        <p className="rounded-xl px-4 py-3 mb-5 font-semibold" style={{ background: "#FEE2E2", color: "#991B1B", fontSize: "0.82rem" }} role="alert">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Full name</label>
            <input value={form.name} onChange={(e) => upd("name", e.target.value)} className="input" placeholder="Chidi Okonkwo" required />
          </div>
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Phone (optional)</label>
            <input value={form.phone} onChange={(e) => upd("phone", e.target.value)} className="input" placeholder="0803 000 0000" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Email</label>
          <input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} className="input" placeholder="you@example.com" autoComplete="email" required />
        </div>
        <div>
          <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Organisation (optional)</label>
          <input value={form.organisation} onChange={(e) => upd("organisation", e.target.value)} className="input" placeholder="Company, church, school or club" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Password</label>
            <input type="password" value={form.password} onChange={(e) => upd("password", e.target.value)} className="input" placeholder="At least 8 characters" autoComplete="new-password" required />
          </div>
          <div>
            <label className="block font-semibold mb-1.5" style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>Confirm password</label>
            <input type="password" value={form.confirm} onChange={(e) => upd("confirm", e.target.value)} className="input" placeholder="Repeat it" autoComplete="new-password" required />
          </div>
        </div>

        <label
          className="flex items-start gap-3 p-4 rounded-2xl cursor-pointer"
          style={{ background: wantsOrganiser ? "var(--violet-bg)" : "var(--surface)", border: `1.5px solid ${wantsOrganiser ? "var(--violet-rim)" : "var(--border)"}` }}
        >
          <input
            type="checkbox"
            checked={wantsOrganiser}
            onChange={(e) => setWantsOrganiser(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>I want to organise events</span>
            <span className="block mt-0.5" style={{ fontSize: "0.78rem", color: "var(--text-2)", lineHeight: 1.55 }}>
              You&apos;ll fill in a short application next. A UEB admin reviews it — you&apos;ll get a notification the moment it&apos;s approved.
            </span>
          </span>
        </label>

        <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
          {busy ? "Creating account…" : wantsOrganiser ? "Create account and continue" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center" style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-bold" style={{ color: "var(--violet-mid)" }}>Sign in</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
      <Navbar />
      <div className="flex items-center justify-center px-5 pt-28 pb-16">
        <Suspense fallback={<div className="card p-8 max-w-lg w-full" style={{ color: "var(--text-3)" }}>Loading…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
