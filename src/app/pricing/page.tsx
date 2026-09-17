"use client";
import Navbar from "@/components/Navbar";
import CreateEventLink from "@/components/CreateEventLink";
import Link from "next/link";

const FREE_FEATURES = [
  "Unlimited free events",
  "Unlimited event pages",
  "Registration management",
  "Custom registration questions",
  "QR code digital tickets",
  "Attendee approval workflow",
  "Mobile smartphone check-in",
  "Invitation-only tickets",
  "Group ticket packages",
  "Discount & promo codes",
  "Capacity controls",
  "Custom confirmation messages",
  "Refund policy display",
  "Social sharing tools",
  "Basic analytics dashboard",
];

const PAID_FEATURES = [
  "Everything in Free",
  "Paid ticket processing",
  "Revenue analytics",
  "Ticket sales dashboard",
  "Paystack & Flutterwave integration",
  "Organiser or attendee fee options",
  "Detailed financial reports",
  "Attendee data export",
  "Check-in analytics",
  "No-show tracking",
  "Multiple ticket tiers",
  "Early-bird pricing",
];

const ENTERPRISE_FEATURES = [
  "Everything in Paid",
  "Dedicated account manager",
  "API access & integrations",
  "White-label event pages",
  "Custom domain",
  "Advanced seating maps",
  "Certificate generation",
  "Automated email campaigns",
  "RFID / NFC wristband support",
  "Multi-organisation management",
  "Custom reporting",
  "Priority 24/7 support",
  "On-site check-in staff",
  "SLA guarantee",
];

const EXAMPLES = [
  { tickets:100,   price:10000,  label:"Small Workshop",   icon:"🔧" },
  { tickets:500,   price:25000,  label:"Conference",        icon:"🎤" },
  { tickets:2000,  price:15000,  label:"Seminar",           icon:"📚" },
  { tickets:10000, price:5000,   label:"Festival",          icon:"🎸" },
];

const FAQ = [
  { q:"Are free events really free?",          a:"Yes, always. If your attendees don't pay, you pay nothing to UEB. Unlimited free events, forever." },
  { q:"When do I pay the UEB fee?",            a:"Only when an attendee purchases a paid ticket. 8% of the ticket price plus ₦100 per transaction — no hidden charges." },
  { q:"How do I receive my money?",            a:"Through Paystack or Flutterwave integrations. Funds settle directly to your bank account according to the payment provider's schedule." },
  { q:"Can I pass the fee to attendees?",      a:"Yes. Choose whether the UEB fee is absorbed from your earnings or added to the attendee's checkout total." },
  { q:"Is there a limit on events I can create?", a:"No. Create as many events as you need — free or paid — without any platform limit." },
  { q:"What's included in Enterprise?",        a:"A dedicated account manager, API access, white-labelling, custom domain, advanced seating, certificate generation, automated comms, and on-site support." },
];

function calcFee(p: number) { return Math.round(p * 0.08 + 100); }

export default function PricingPage() {
  return (
    <div style={{ background:"var(--surface)" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden noise"
        style={{
          background:"linear-gradient(150deg, #0A0A0F 0%, #1C1C2E 40%, #2D1B69 70%, #4C1D95 100%)",
          paddingTop:"clamp(6rem, 14vw, 10rem)",
          paddingBottom:"clamp(4rem, 10vw, 7rem)",
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:`linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)`,
            backgroundSize:"60px 60px",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <p className="label-caps mb-4" style={{ color:"rgba(167,139,250,0.8)" }}>Simple pricing</p>
          <h1 className="display-1 text-white mb-5">
            Free to start.<br />
            <span className="text-grad-violet">Pay when you earn.</span>
          </h1>
          <p style={{ fontSize:"1.15rem", color:"rgba(255,255,255,0.6)", maxWidth:540, margin:"0 auto 2.5rem", lineHeight:1.75 }}>
            Free events are always free. For paid events, just <strong style={{ color:"rgba(255,255,255,0.9)" }}>8% + ₦100</strong> per ticket.
            No setup fees. No monthly charges to get started.
          </p>
          <div className="glass inline-flex items-center gap-4 px-6 py-4 rounded-2xl" style={{ borderColor:"rgba(255,255,255,0.12)" }}>
            <div className="text-center">
              <div className="font-black text-white" style={{ fontSize:"2rem", letterSpacing:"-0.04em" }}>₦0</div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Free Events</div>
            </div>
            <div style={{ width:1, height:48, background:"rgba(255,255,255,0.15)" }}/>
            <div className="text-center">
              <div className="font-black text-white" style={{ fontSize:"1.4rem", letterSpacing:"-0.03em" }}>8% + ₦100</div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Per Paid Ticket</div>
            </div>
            <div style={{ width:1, height:48, background:"rgba(255,255,255,0.15)" }}/>
            <div className="text-center">
              <div className="font-black text-white" style={{ fontSize:"2rem", letterSpacing:"-0.04em" }}>Custom</div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Enterprise</div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-16" style={{ background:"linear-gradient(to bottom,transparent,var(--surface))" }}/>
      </section>

      {/* ── PLANS ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Free */}
          <div className="card flex flex-col p-7">
            <div className="mb-7">
              <p className="label-caps mb-2" style={{ color:"var(--text-3)" }}>Free Plan</p>
              <div className="flex items-end gap-2 mb-3">
                <span className="font-black" style={{ fontSize:"3.25rem", color:"var(--text-1)", letterSpacing:"-0.05em", lineHeight:1 }}>₦0</span>
              </div>
              <p style={{ fontSize:"0.85rem", color:"var(--text-3)", lineHeight:1.65 }}>For organisers running free events. No credit card required.</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-7">
              {FREE_FEATURES.map(f=>(
                <li key={f} className="flex items-start gap-2.5" style={{ fontSize:"0.83rem", color:"var(--text-2)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:"var(--green)", flexShrink:0, marginTop:"0.1rem" }}>
                    <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <CreateEventLink href="/events/create" className="btn btn-dark w-full justify-center">Get Started Free</CreateEventLink>
          </div>

          {/* Transaction */}
          <div className="flex flex-col p-7 rounded-2xl relative" style={{ background:"linear-gradient(145deg,var(--violet-low),var(--violet-mid))", boxShadow:"var(--shadow-xl)" }}>
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-black text-xs tracking-widest uppercase"
              style={{ background:"var(--gold)", color:"var(--ink)" }}
            >
              Most Popular
            </div>
            <div className="mb-7">
              <p className="label-caps mb-2" style={{ color:"rgba(255,255,255,0.55)" }}>Transaction Pricing</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-black text-white" style={{ fontSize:"3.25rem", letterSpacing:"-0.05em", lineHeight:1 }}>8%</span>
                <span className="text-white/70 font-medium pb-2" style={{ fontSize:"1rem" }}>+ ₦100</span>
              </div>
              <p style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.55)", marginBottom:"0.25rem" }}>per paid ticket</p>
              <p style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.75)", lineHeight:1.65 }}>No monthly fee. Only pay when you sell tickets.</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-7">
              {PAID_FEATURES.map(f=>(
                <li key={f} className="flex items-start gap-2.5" style={{ fontSize:"0.83rem", color:"rgba(255,255,255,0.85)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:"#A7F3D0", flexShrink:0, marginTop:"0.1rem" }}>
                    <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <CreateEventLink href="/events/create" className="btn btn-white w-full justify-center" style={{ color:"var(--violet-low)", fontWeight:800 }}>
              Start Selling Tickets
            </CreateEventLink>
          </div>

          {/* Enterprise */}
          <div className="card flex flex-col p-7">
            <div className="mb-7">
              <p className="label-caps mb-2" style={{ color:"var(--text-3)" }}>Enterprise</p>
              <div className="flex items-end gap-2 mb-3">
                <span className="font-black" style={{ fontSize:"3.25rem", color:"var(--text-1)", letterSpacing:"-0.05em", lineHeight:1 }}>Custom</span>
              </div>
              <p style={{ fontSize:"0.85rem", color:"var(--text-3)", lineHeight:1.65 }}>For universities, corporations, government and large-scale operations.</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-7">
              {ENTERPRISE_FEATURES.map(f=>(
                <li key={f} className="flex items-start gap-2.5" style={{ fontSize:"0.83rem", color:"var(--text-2)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:"#0891B2", flexShrink:0, marginTop:"0.1rem" }}>
                    <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <a href="mailto:enterprise@ueb.ng" className="btn btn-outline w-full justify-center">Contact Sales →</a>
          </div>
        </div>
      </section>

      {/* ── REVENUE CALCULATOR ── */}
      <section style={{ background:"#fff", borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20">
          <div className="text-center mb-12">
            <p className="label-caps mb-3" style={{ color:"var(--violet-mid)" }}>Transparency first</p>
            <h2 className="display-2" style={{ color:"var(--text-1)" }}>Exactly what you earn</h2>
            <p className="mt-3" style={{ color:"var(--text-3)", fontSize:"0.95rem" }}>No surprises. See the maths for common event sizes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {EXAMPLES.map(ex=>{
              const fee = calcFee(ex.price);
              const orgPerTkt = ex.price - fee;
              const orgTotal  = orgPerTkt * ex.tickets;
              const uebTotal  = fee * ex.tickets;
              const pct = Math.round((orgTotal / (ex.price * ex.tickets)) * 100);
              return (
                <div key={ex.label} className="rounded-2xl p-6 border transition-all duration-300" style={{ borderColor:"var(--border)" }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--violet-rim)";(e.currentTarget as HTMLDivElement).style.boxShadow="var(--shadow-lg)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--border)";(e.currentTarget as HTMLDivElement).style.boxShadow="";}}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize:"1.75rem" }}>{ex.icon}</span>
                      <div>
                        <p className="font-bold" style={{ fontSize:"0.95rem", color:"var(--text-1)" }}>{ex.label}</p>
                        <p style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>{ex.tickets.toLocaleString()} tickets · ₦{ex.price.toLocaleString()} each</p>
                      </div>
                    </div>
                    <div
                      className="px-2.5 py-1 rounded-full font-black text-xs"
                      style={{ background:"var(--violet-bg)", color:"var(--violet-mid)" }}
                    >
                      {pct}% yours
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { l:"Gross ticket revenue",  v:`₦${(ex.price*ex.tickets).toLocaleString()}`,  dim:false },
                      { l:"UEB fee per ticket",     v:`−₦${fee.toLocaleString()}`,                  dim:false, red:true },
                      { l:"Your earnings per ticket",v:`₦${orgPerTkt.toLocaleString()}`,            dim:false, bold:true, green:true },
                    ].map(row=>(
                      <div key={row.l} className="flex justify-between items-center" style={{ fontSize:"0.83rem" }}>
                        <span style={{ color:"var(--text-3)" }}>{row.l}</span>
                        <span style={{ fontWeight:row.bold?800:600, color:row.red?"var(--red)":row.green?"var(--green)":"var(--text-1)" }}>{row.v}</span>
                      </div>
                    ))}
                    <div className="h-px my-1" style={{ background:"var(--border)" }}/>
                    <div className="flex justify-between items-center">
                      <span className="font-bold" style={{ fontSize:"0.9rem", color:"var(--text-1)" }}>Your total event revenue</span>
                      <span className="font-black" style={{ fontSize:"1.1rem", color:"var(--green)", letterSpacing:"-0.02em" }}>₦{orgTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>UEB platform fee (total)</span>
                      <span style={{ fontSize:"0.78rem", color:"var(--text-3)", fontWeight:600 }}>₦{uebTotal.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* Progress bar showing organiser's share */}
                  <div className="mt-4 progress-track">
                    <div className="progress-fill" style={{ width:`${pct}%`, background:"linear-gradient(90deg,var(--violet),var(--violet-hi))" }}/>
                  </div>
                  <p style={{ fontSize:"0.7rem", color:"var(--text-3)", marginTop:"0.4rem" }}>You keep {pct}% of gross revenue</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEE OPTIONS ── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-20">
        <div className="text-center mb-12">
          <p className="label-caps mb-3" style={{ color:"var(--violet-mid)" }}>Your choice</p>
          <h2 className="display-2" style={{ color:"var(--text-1)" }}>Who pays the UEB fee?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon:"🏢", title:"Option A — Organiser Absorbs",
              desc:"The UEB fee is deducted from your earnings. Attendees see a clean, round price.",
              rows:[
                { l:"Ticket price shown", v:"₦10,000" },
                { l:"Attendee pays", v:"₦10,000" },
                { l:"UEB fee deducted", v:"−₦900", red:true },
                { l:"You receive", v:"₦9,100", green:true, bold:true },
              ],
            },
            {
              icon:"👤", title:"Option B — Attendee Pays",
              desc:"The UEB fee is added to the checkout price. You receive your full ticket amount.",
              rows:[
                { l:"Your ticket price", v:"₦10,000" },
                { l:"UEB fee added", v:"+₦900" },
                { l:"Attendee pays total", v:"₦10,900" },
                { l:"You receive", v:"₦10,000", green:true, bold:true },
              ],
            },
          ].map(opt=>(
            <div key={opt.title} className="card p-7">
              <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>{opt.icon}</div>
              <h3 className="font-black mb-2" style={{ fontSize:"1.1rem", color:"var(--text-1)", letterSpacing:"-0.02em" }}>{opt.title}</h3>
              <p style={{ fontSize:"0.85rem", color:"var(--text-3)", marginBottom:"1.5rem", lineHeight:1.65 }}>{opt.desc}</p>
              <div className="rounded-xl overflow-hidden" style={{ border:"1px solid var(--border)" }}>
                {opt.rows.map((row,i)=>(
                  <div
                    key={row.l}
                    className="flex justify-between px-4 py-3"
                    style={{ background: i%2===0?"var(--surface)":"#fff", fontSize:"0.82rem" }}
                  >
                    <span style={{ color:"var(--text-3)" }}>{row.l}</span>
                    <span style={{ fontWeight:row.bold?800:600, color:row.red?"var(--red)":row.green?"var(--green)":"var(--text-1)" }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background:"#fff", borderTop:"1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20">
          <div className="text-center mb-12">
            <p className="label-caps mb-3" style={{ color:"var(--violet-mid)" }}>Got questions?</p>
            <h2 className="display-2" style={{ color:"var(--text-1)" }}>Frequently asked</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(item=>(
              <div key={item.q} className="rounded-2xl p-5 border transition-all duration-200" style={{ border:"1.5px solid var(--border)", background:"#fff" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--violet-rim)";(e.currentTarget as HTMLDivElement).style.background="var(--violet-bg)";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--border)";(e.currentTarget as HTMLDivElement).style.background="#fff";}}
              >
                <h3 className="font-bold mb-2" style={{ fontSize:"0.95rem", color:"var(--text-1)" }}>{item.q}</h3>
                <p style={{ fontSize:"0.83rem", color:"var(--text-3)", lineHeight:1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20" style={{ background:"linear-gradient(135deg,var(--violet-bg),#EDE9FE)", borderTop:"1px solid var(--violet-rim)" }}>
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="display-2 mb-4" style={{ color:"var(--ink)" }}>Ready to get started?</h2>
          <p style={{ color:"var(--text-3)", fontSize:"1rem", marginBottom:"2rem", lineHeight:1.7 }}>
            Create your first event for free today. No credit card required. No monthly commitment.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <CreateEventLink href="/events/create" className="btn btn-primary btn-lg">Create Your Event →</CreateEventLink>
            <Link href="/events" className="btn btn-outline btn-lg">Explore Events</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
