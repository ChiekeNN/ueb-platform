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
| `/login` · `/signup` | Accounts — email + password, scrypt hashes, HTTP-only session cookie |
| `/become-organiser` | Organiser application + its pending / declined / approved states |
| `/dashboard` | **Approved organisers and admins only** — the organiser's own portfolio, attendee approvals, quick actions |
| `/admin` | **Platform admins only** — the organiser approval queue, platform stats and the notification feed |
| `/notifications` | Full notification history (platform-wide for admins, own-events for organisers) |
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

## Accounts, organiser approval & notifications

**The dashboard is never public.** It is not in the menu for a signed-out
visitor, and `/dashboard` and `/admin` both bounce to `/login?next=…` without a
session. Only two kinds of account get in:

| Who | Sees | How they get there |
|---|---|---|
| **Platform admin** | `/admin` (the approval queue, platform stats) and every event in `/dashboard` | Seeded — `admin@ueb.ng` |
| **Approved organiser** | `/dashboard`, their own events only | Applies, an admin approves |
| Attendee / applicant | a status screen with the next step, no event data | — |

### Becoming an organiser (admin-approved)

1. Sign up (or press **Become an organiser**) → `/become-organiser`.
2. The application is filed with `organiser_status = 'pending'` and the admin
   bell rings immediately.
3. An admin opens **/admin → Applications**, reviews the details and approves or
   declines with a note. Approve is the *only* thing in the platform that grants
   organiser powers: it sets `role = event_owner` + `organiser_status = approved`.
4. The applicant gets a notification either way; a declined applicant can fix
   their details and re-apply.

`POST /api/events` enforces the same rule server-side (403 unless an admin or an
approved organiser), and `GET /api/events?mine=1` answers "my events" from the
session — never from a query parameter.

### Notification bell

One component, two audiences, one table (`notifications`):

- **Platform rows** (`user_id IS NULL`, `scope = 'platform'`) ring every admin's
  bell: new organiser applications, signups, event submissions, registrations,
  payments and refunds — from all parts of the platform.
- **Personal rows** carry a `user_id`: registrations and payments for an
  organiser's own events, and application decisions for the applicant.

The bell polls every 30 seconds, badges unread counts, and marks items read on
open (scoped to the caller's own audience). `/notifications` is the full history.

### Session model

`src/lib/auth.ts` — scrypt password hashes (`scrypt:<salt>:<hash>`), a 32-byte
random cookie token whose **SHA-256 hash** is what the `sessions` table stores,
30-day expiry, `httpOnly` + `sameSite=lax` + `secure` in production. Every event
mutation goes through `requireEventAccess(slug)`: platform admins and the owning
organiser only, so an attendee cannot read another organiser's guest list by
guessing a slug.

### Demo accounts

After `POST /api/seed` (or **Load Demo Data**), all four share the password
`demo1234`:

| Email | Role |
|---|---|
| `admin@ueb.ng` | Platform admin — sees `/admin`, the queue and the platform bell |
| `chidi@upec.edu.ng` | Approved organiser — owns several seeded events |
| `amara@abccorp.ng` | Approved organiser — owns the rest |
| `tunde@naijabiz.ng` | **Application pending** — so the admin queue has something to approve |

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
POST/GET        /api/auth/signup|login|logout    accounts (scrypt + session cookie)
GET             /api/auth/session                who am I: isAdmin / isOrganiser / canAccessDashboard
GET/POST        /api/organiser-applications      admin queue · apply to become an organiser
PATCH           /api/organiser-applications/[id] approve/decline (platform admin only)
GET/PATCH       /api/notifications               the bell feed · mark read
GET             /api/admin/overview              platform stats for the admin dashboard
POST            /api/seed                       demo dataset (incl. demo accounts)
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
