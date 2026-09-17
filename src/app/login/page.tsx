import Link from "next/link";
import Navbar from "@/components/Navbar";

const ROLES = [
  { href: "/admin/login", label: "Platform admin", description: "Manage the UEB marketplace, users and platform activity.", icon: "🛡️", tone: "var(--violet-bg)" },
  { href: "/organizer/login", label: "Event organiser", description: "Create, sell, check in and report on your events.", icon: "🗓️", tone: "#ECFEFF" },
  { href: "/subscriber/login", label: "Subscriber", description: "Save events, manage tickets and keep your plans together.", icon: "🎟️", tone: "#ECFDF5" },
];

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <p className="label-caps mb-3" style={{ color: "var(--violet-mid)" }}>UEB account</p>
          <h1 className="display-2" style={{ color: "var(--text-1)" }}>Choose your workspace</h1>
          <p className="mt-4" style={{ color: "var(--text-3)", lineHeight: 1.7 }}>One platform, with the right tools for every person involved in an event.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ROLES.map((role) => (
            <div key={role.href} className="card card-lift p-6">
              <Link href={role.href} style={{ textDecoration: "none" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5" style={{ background: role.tone }}>{role.icon}</div>
                <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.2rem" }}>{role.label}</h2>
                <p className="mt-2" style={{ color: "var(--text-3)", fontSize: "0.84rem", lineHeight: 1.65 }}>{role.description}</p>
                <span className="inline-flex mt-6" style={{ color: "var(--violet-mid)", fontWeight: 800, fontSize: "0.82rem" }}>Sign in →</span>
              </Link>
              <Link href={role.href.replace("/login", "/signup")} className="inline-flex mt-3" style={{ color: "var(--text-3)", fontSize: "0.72rem", fontWeight: 700 }}>Need an account? Sign up</Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
