import Link from "next/link";
import Navbar from "@/components/Navbar";

const TYPES = [
  ["/organizer/signup", "🗓️", "Event organiser", "Create events after admin approval.", "var(--violet-bg)"],
  ["/subscriber/signup", "🎟️", "Subscriber", "Discover events and manage tickets.", "#ECFDF5"],
  ["/admin/signup", "🛡️", "Platform admin", "Request platform administration access.", "#FEF3C7"],
] as const;

export default function SignupPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        <div className="max-w-2xl mx-auto text-center mb-10"><p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>Join UEB</p><h1 className="display-2" style={{ color: "var(--text-1)" }}>Choose an account</h1><p className="mt-4" style={{ color: "var(--text-3)", lineHeight: 1.7 }}>Different people need different tools. Choose the workspace that fits you.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TYPES.map(([href, icon, title, copy, background]) => <Link key={href} href={href} className="card card-lift p-6" style={{ textDecoration: "none" }}><div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5" style={{ background }}>{icon}</div><h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>{title}</h2><p className="mt-2" style={{ color: "var(--text-3)", fontSize: "0.82rem", lineHeight: 1.6 }}>{copy}</p><span className="inline-flex mt-6" style={{ color: "var(--violet-mid)", fontWeight: 800, fontSize: "0.8rem" }}>Get started →</span></Link>)}
        </div>
      </main>
    </div>
  );
}
