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

### 1. Create a hosted PostgreSQL database

Use **either Neon or Supabase** — you do not need both.

- **Neon:** create a project, open **Connect**, copy the PostgreSQL connection string. The pooled connection is a good choice for a deployed Next.js app.
- **Supabase:** create a project, open **Connect**, choose the **Session pooler** connection string, and copy the URI.

Both connection strings normally end with `?sslmode=require`. Keep the password private.

### 2. Put the connection string in `.env`

Copy `.env.example` to a new `.env` file in the repository root (the same folder as `package.json`) and replace the example values with your real values:

```bash
# macOS/Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Then edit `.env`:

```bash
DATABASE_URL='postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST/YOUR_DATABASE?sslmode=require'
AUTH_SECRET='replace-with-a-long-random-secret'
```

Do not commit `.env` or paste the password into chat. This repository already ignores `.env` files.

### 3. Create UEB's tables in your hosted database

Run these commands from the repository folder:

```bash
npm install
npx drizzle-kit push --force
npm run dev
```

The `drizzle-kit` configuration reads `DATABASE_URL` from `.env`, so it will create the tables in Neon or Supabase rather than on your own computer.

### 4. Load UEB's first-party events

With the development server running, open a second terminal and run:

```bash
curl -X POST http://localhost:3000/api/seed
```

Then open `http://localhost:3000/events` and refresh the page. This creates the showcase events plus at least six UEB-owned events in every category.

You can also use **Seed database** from the organiser dashboard after the database is configured. The seed creates these preview accounts:

- Admin: `admin@ueb.ng` / `admin1234`
- Approved organiser: `chidi@upec.edu.ng` / `organizer1234`
- Subscriber: `subscriber@ueb.ng` / `subscriber1234`

### Access control

Signups are available at `/organizer/signup`, `/subscriber/signup`, and `/admin/signup`. Subscriber accounts are active immediately. Organiser and admin requests begin as `pending`; an authenticated admin approves or rejects organiser requests from `/admin`. Only an authenticated admin or approved organiser can create an event. The same rule is enforced in `POST /api/events`, so hiding a button is not the security boundary.

For a deployed app, add the same `DATABASE_URL` and a strong `AUTH_SECRET` value to the hosting provider's environment variables, redeploy, and call `/api/seed` on the deployed URL instead of `localhost`. Never commit the connection string or secret.

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

## Discovery & event-page idiom

Attendee-facing surfaces follow the layout conventions organisers' audiences
already know from large ticketing sites, but every link stays inside UEB:

- **Cards** carry a 2:1 cover, `Tue, 9 Feb, 10 AM + 3 more` date lines,
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

The demo catalogue is first-party UEB data: `POST /api/seed` creates at least six
published events in every category, with local covers and UEB-owned registration,
payment, ticket and check-in flows. Discovery cards link only to UEB event pages;
there is no Eventbrite, Ticketmaster or other competitor handoff. If PostgreSQL is
not connected yet, Home, Discover and the read-only event preview automatically
serve the same 90-event UEB catalogue so the product can be previewed immediately.
Connect the database and run the seed command to enable persistent registrations,
payments and organiser management. Replace the catalogue seed records with
organiser-created events as production data arrives, without changing the
discovery API or card experience.

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
