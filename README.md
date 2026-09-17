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

Then load the demo dataset (a showcase set plus at least 6 first-party events in every category):

```bash
curl -X POST http://localhost:3000/api/seed
```

…or press **Load Demo Data** on the home page.

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
there is no Eventbrite, Ticketmaster or other competitor handoff. Replace the
catalogue seed records with organiser-created events as production data arrives,
without changing the discovery API or card experience.

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
