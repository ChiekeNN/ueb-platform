import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    heading: "Platform",
    links: [
      ["Discover Events", "/events"],
      ["Create Event", "/events/create"],
      ["Dashboard", "/dashboard"],
      ["Check-In", "/checkin"],
    ],
  },
  {
    heading: "Pricing",
    links: [
      ["Free Events", "/pricing"],
      ["Paid Tickets", "/pricing"],
      ["Enterprise", "/pricing"],
      ["API Access", "/pricing"],
    ],
  },
  {
    heading: "Event Types",
    links: [
      ["Conferences", "/events"],
      ["Workshops", "/events"],
      ["Church Events", "/events"],
      ["Corporate", "/events"],
      ["University", "/events"],
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer style={{ background: "var(--ink)", color: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4" aria-label="UEB home">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)" }}>
                <span className="font-black text-white" style={{ fontSize: "10px" }}>UEB</span>
              </div>
              <span className="font-black text-xl tracking-tight">UEB</span>
            </Link>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, maxWidth: 260 }}>
              Africa&apos;s Event Operating System. Create, manage, sell, and understand events — all in one place.
            </p>
            <div className="flex gap-3 mt-5" aria-label="Social links">
              {["Twitter/X", "LinkedIn", "Instagram"].map((social) => (
                <div
                  key={social}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  style={{ background: "rgba(255,255,255,0.07)", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}
                  title={social}
                  aria-label={social}
                >
                  {social[0]}
                </div>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="label-caps mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>{column.heading}</p>
              <div className="space-y-2.5">
                {column.links.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="block transition-colors duration-200 footer-link"
                    style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="divider-gradient mb-8" style={{ opacity: 0.15 }} />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)" }}>© 2027 Unique Events Booking Ltd. Built for Africa.</p>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>Free events always free · 8% + ₦100 per paid ticket</p>
        </div>
      </div>
    </footer>
  );
}
