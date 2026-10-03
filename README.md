# UEB — Unique Events Booking

Africa's **Event Operating System**. Not a ticket-selling website — a single
platform for the whole lifecycle of an event:

> Create → Publish → Register → Approve → Pay → Ticket → Verify → Attend → Analyse → Report → Follow up

Built first for Nigeria, architected for African expansion and beyond.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS v4** with the design tokens in `src/app/globals.css`
- **PostgreSQL** + **Drizzle ORM**
- `qrcode` for ticket QR payloads, `nanoid` for slugs, `date-fns` for dates

## Running locally

```bash
npm install
echo "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db" > .env
npx drizzle-kit push --force     # create the schema
npm run dev                      # http://localhost:3000
```

Then load the demo dataset (7 events covering every event type):

```bash
curl -X POST http://localhost:3000/api/seed
```

…or press **Load Demo Data** on the home page.

## Deploying

Set `DATABASE_URL` in the host's environment (Vercel → Project → Settings →
Environment Variables) pointing at a hosted Postgres such as Neon, Supabase or
Vercel Postgres.

The build no longer needs it: `src/db/index.ts` creates the pool on first use,
so a missing variable surfaces at the first query rather than failing the build.
The app still will not serve data without it.

`drizzle.config.ts` reads `DATABASE_URL`, so the same migration command works
against any database:

```bash
DATABASE_URL="postgresql://…/production_db" npx drizzle-kit push --force
```

Run that once from your machine against the production database — the host does
not run migrations for you.

## Product surfaces

| Route | Purpose |
|---|---|
| `/` | Marketing page: boxed centred hero, capability pillars, segments, roadmap |
| `/events` | Public event discovery — sticky filter rail (search, city, date, price, format, category, sort) over card grid with click-to-open quick-look |
| `/events/[slug]` | Event page: hero, "Good to know", organiser stats, agenda/slots, vendors, FAQ, sticky ticket rail, related events, feedback |
| `/events/[slug]/ticket/[ticketNumber]` | Printable digital ticket with QR code and calendar file |
| `/pay/[reference]` | Checkout (card / transfer / USSD) with fee breakdown |
| `/events/[slug]/manage` | **Organiser console** — overview, attendees, tickets, invitations, schedule & slots, seating, vendors, comms, reports, post-event |
| `/events/[slug]/report` | Full event report with CSV exports |
| `/checkin` | Venue check-in desk (QR / ticket number verification) |
| `/dashboard` | Organiser portfolio, approvals and quick actions |
| `/pricing` | Transparent pricing — free events free, 8% + ₦100 per paid ticket |

See [`docs/FEATURE-MAP.md`](docs/FEATURE-MAP.md) for how each capability from the
product brief is implemented.

## Installable app (PWA)

UEB is installable — the browser's own "Install app" / "Add to Home Screen"
route, plus an in-app offer that follows one deliberate schedule:

| Behaviour | Where | Value |
|---|---|---|
| Offer appears after the app has been open this long | `src/lib/pwa.ts` | **5 seconds** |
| Offer stays on screen, then withdraws by itself | `src/lib/pwa.ts` | **10 seconds** |
| Hidden entirely once UEB is installed | `isAppInstalled()` | standalone mode, `appinstalled` event, `getInstalledRelatedApps()` |
| "Not now" (× button) re-offers after | `snoozeInstallPrompt()` | 7 days |

Files that make it work:

- `src/app/manifest.ts` → `/manifest.webmanifest` — name, icons, `standalone`, shortcuts.
- `public/sw.js` — service worker with a `fetch` handler (required before
  Chrome/Edge fire `beforeinstallprompt`). Network-first for pages, cache-first
  for static assets, never touches `/api/*`. In `next dev` it is registered as
  `?dev=1`, which disables caching so a stale chunk can't shadow the dev server.
- `public/icons/*` + `src/app/icon.png` — 192/512/maskable PNGs and the favicon.
- `src/lib/pwa.ts` — the rules above, plus `registerServiceWorker()`.
- `src/components/InstallAppPrompt.tsx` — the offer itself (mounted in the root
  layout). On browsers with a native dialog the button opens it; on iOS Safari
  it reveals Share → Add to Home Screen instead.

## Date & time convention

**Every date in the product is `DD/MM/YYYY`** — `17/11/2027`, padded, local time,
with the year in full. Times stay 12-hour (`6:30 PM`) in the UI and 24-hour
(`18:30`) in exports.

Format through the helpers in `src/lib/utils.ts` rather than `toLocaleDateString`
directly, so the convention can't drift:

- `formatDate()` · `formatDateTime()` — display and ticket/print surfaces
- `formatDateKey()` — day keys (`2027-11-17`) from timelines and date pickers
- `formatDateStamp()` — timestamped CSV cells (`17/11/2027 18:30`)
- `eventDateShort()` · `eventDateLine()` — cards and the event page headline

`<input type="date">` values stay ISO (`YYYY-MM-DD`) — that is the browser's
format, not ours; only render it through `formatDateKey()`.

## Discovery & event-page idiom

Attendee-facing surfaces follow the layout conventions organisers' audiences
already know from large ticketing sites, but every link stays inside UEB:

- **Cards** carry a 2:1 cover, `09/02/2027, 10 AM + 3 more` date lines,
  `City · Venue` (or `Online event`), `Free` / `From ₦35,000`, the organising
  account with its follower count, and Save/Share actions.
- **Click any event — home page, Discover grid or the "More events" rail — and
  the details pop out in place** (`EventDetailsModal`): cover, badges, date and
  location, price, highlights, organiser card, clamped overview and a
  `Get tickets` CTA that opens the registration flow without a page change.
  "Full details" is the only navigation, and it goes to the UEB event page.
- **The event page** keeps a sticky ticket rail (tier steppers, capacity bar,
  `Get tickets`), a floating action bar that appears once the hero scrolls away,
  and an organiser block with followers / events hosted / attendees hosted.
- **Saved events** live in `localStorage` (`ueb.saved.events`) — no accounts
  required, no third-party calls.
- Covers ship in `public/events/*.jpg`; a missing cover degrades to a
  category-coloured gradient rather than breaking the card.

`GET /api/events` backs all of it with facets — `status`, `category`, `city`,
`format`, `when=today|tomorrow|weekend|week|month`, `sort=date|newest`,
`search`, `limit` (≤120) and `tiers=1` to hydrate ticket types, next session
date, session and slot counts plus the organiser/org profile in one round trip.

### Layout rule (important)

`src/app/globals.css` only asserts `box-sizing` in its reset. Utility-driven
layout assumes Tailwind's preflight owns vertical margins; unlayered CSS
outranks `@layer` utilities, so re-declaring `margin: 0` outside a layer
silently kills `mx-auto` and every `mt-*` spacing class — which is what pushed
page content to the left edge. Keep resets inside Tailwind's layers.

## API surface

```
GET/POST        /api/events                     list + create (recurrence, slots, seating)
GET/PATCH/DELETE/api/events/[slug]              detail (+ workspace), settings, delete
GET/POST/PATCH/DELETE /api/events/[slug]/tiers        ticket types & inventory
GET/POST/PATCH/DELETE /api/events/[slug]/occurrences  recurring sessions
GET/POST/PATCH/DELETE /api/events/[slug]/slots        appointment windows
GET/POST        /api/events/[slug]/invitations  invitations + invite codes
GET/POST/PATCH  /api/events/[slug]/registrations attendee roster, bulk approval
GET/POST/PATCH/DELETE /api/events/[slug]/seating      seating plans & assignments
GET/POST        /api/events/[slug]/vendors      vendor roster
GET/PATCH/DELETE/api/vendors/[id]               vendor updates
GET/POST        /api/events/[slug]/messages     audience segments + campaigns
GET/POST        /api/events/[slug]/report       analytics (JSON/CSV)
GET/POST        /api/events/[slug]/post-event   close-out, thank-you, survey, follow-up
GET/POST        /api/registrations              register (free/paid/group/slot/invite/waitlist)
PATCH/DELETE    /api/registrations/[id]         approve, reject, hold, pay, check in
GET/POST        /api/payments                   initialize → verify → refund
GET/POST        /api/checkin                    venue verification + scan audit log
GET             /api/tickets/[ticketNumber]     digital ticket lookup
POST            /api/seed                       demo dataset
```

## Money model

- Free events: **always free**, no fee.
- Paid events: **8% + ₦100** per ticket, either absorbed by the organiser or
  added to the attendee's total — configurable per event.
- Tickets are released only when a registration is **approved and paid**, so
  unpaid or pending guests cannot pass the door.

## Integrations

Payments, email/SMS/WhatsApp delivery and certificates run against **simulated
transport** in this environment (see the table at the end of
`docs/FEATURE-MAP.md`). Every integration point is isolated in
`src/lib/server.ts` and `src/app/api/payments/route.ts`, so production
credentials can be dropped in without touching the product logic.
