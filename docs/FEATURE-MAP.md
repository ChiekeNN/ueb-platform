# UEB — Feature Map

How each capability from the UEB product brief maps to working code in this
repository. Everything listed here is implemented end-to-end (database →
API → screen) and exercised by the seed data.

## The 25 capabilities

| # | Capability from the brief | Where it lives | Status |
|---|---|---|---|
| 1 | Create events | `/events/create` wizard (3 steps) → `POST /api/events` | ✅ |
| 2 | Publish event pages | `/events/[slug]` public page, publish/unpublish in `/events/[slug]/manage` | ✅ |
| 3 | Sell free and paid tickets | Ticket tiers (`/events/[slug]/manage` → Tickets), checkout at `/pay/[reference]` | ✅ paid flow is a sandbox gateway |
| 4 | Manage guest registrations | Attendees tab in the organiser console | ✅ |
| 5 | Approve or reject attendees | Row actions + bulk approve/hold/reject (`PATCH /api/events/[slug]/registrations`) | ✅ |
| 6 | Send invitations | Invitations tab → invite codes, delivery log (`/api/events/[slug]/invitations`) | ✅ delivery is logged, not really emailed |
| 7 | Create recurring events | Create wizard → Recurring; rule editor + session list in the console's Schedule tab | ✅ |
| 8 | Create appointment / time-slot events | Create wizard → Time Slots; slot generator in Schedule tab; guests pick a slot on the event page | ✅ |
| 9 | Manage individual and group tickets | Ticket types (`group`, `groupSize`) + quantity selector on the event page — one registration per guest, linked by `group_id` | ✅ |
| 10 | Create invitation-only tickets | Ticket type `invitation_only` with an access code, plus per-guest invite codes | ✅ |
| 11 | Collect customised attendee information | `customQuestions` in the wizard → dynamic fields on the event page → answers analysed in Reports | ✅ |
| 12 | Process payments | `POST /api/payments` (initialize → verify → refund), 8% + ₦100 fee engine in `lib/utils.ts` | ✅ sandbox settlement |
| 13 | Generate unique digital tickets | `issueTicket()` in `lib/server.ts`, rendered at `/events/[slug]/ticket/[ticketNumber]` | ✅ |
| 14 | Generate QR codes | `qrcode` payload `{ticketNumber, eventId, attendeeEmail}` on every issued ticket | ✅ |
| 15 | Verify attendees at the venue | `/checkin` desk + `POST /api/checkin` (VALID / ALREADY_USED / UNPAID / PENDING / INVALID) | ✅ |
| 16 | Manage seating | Seating tab: sections, auto-labelled seats, auto-assign by tier, block/release/assign | ✅ |
| 17 | Manage vendors | Vendors tab: roster, stall numbers, fees, payments, status | ✅ |
| 18 | Monitor attendance | Live counters on the console overview, check-in velocity, scan audit log | ✅ |
| 19 | Communicate with attendees | Comms tab: audience segments (approved, unpaid, checked-in, no-shows, vendors, waitlist…), email/SMS/WhatsApp, history | ✅ transport is simulated |
| 20 | Generate event reports | `/events/[slug]/report` + CSV exports (`attendees`, `sales`, `checkins`, `feedback`, `vendors`, `payments`) | ✅ |
| 21 | Analyse ticket sales and attendance | Sales by tier, timelines, status funnels, custom-answer stats on the report screen | ✅ |
| 22 | Manage post-event activities | Post-event tab: close-out checklist, thank-you, survey, no-show follow-up, certificates hook | ✅ |
| 23 | Waitlist (supporting capability) | Automatic when capacity is reached and waitlists are enabled | ✅ |
| 24 | Fee handling | Fee absorbed by organiser or passed to the attendee, shown in the wizard and checkout | ✅ |
| 25 | Multi-event operations | `/dashboard` for the organiser's event portfolio, `/events` public discovery with search + category filters | ✅ |

## Product surfaces

| Surface | Route | Who it's for |
|---|---|---|
| Marketing home | `/` | Prospective organisers — centred hero, 25-capability pillars, 15 segments, Nigeria → Africa → international roadmap |
| Event discovery | `/events` | Attendees |
| Event page | `/events/[slug]` | Attendees — schedule, slots, vendors, ticket tiers, group tickets, invite codes, feedback |
| Digital ticket | `/events/[slug]/ticket/[ticketNumber]` | Attendees — printable ticket + QR + calendar file |
| Checkout | `/pay/[reference]` | Attendees — card / transfer / USSD / direct transfer |
| Organiser console | `/events/[slug]/manage` | Organisers — 10 tabs covering the full lifecycle |
| Event report | `/events/[slug]/report` | Organisers, sponsors, funders — printable |
| Check-in desk | `/checkin` | Venue staff |
| Dashboard | `/dashboard` | Organisers — portfolio view and approvals |
| Pricing | `/pricing` | Prospective organisers — free events free, 8% + ₦100 per paid ticket |

## Lifecycle the platform implements

```
Create → Publish → Register → Approve → Pay → Ticket → Verify → Attend → Analyse → Report → Follow up
```

## Data model additions

Beyond the original tables (`users`, `organisations`, `events`, `ticket_tiers`,
`registrations`, `invitations`, `discount_codes`, `event_staff`):

`event_occurrences` · `event_slots` · `seating_sections` · `seats` ·
`vendors` · `payments` · `event_messages` · `checkin_logs` ·
`event_feedback` · `waitlist_entries`

New columns: `events.recurrence_rule`, `events.seat_selection_enabled`,
`events.waitlist_enabled`, `events.post_event_message`, `events.survey_url`,
`events.completed_at`; `registrations.quantity | group_id | is_group_lead |
guests | slot_id | slot_label | seat_id | seat_label | ticket_issued_at |
payment_reference | checked_in_by`; `invitations.*` (tier, guests, notes, phone).

## Sandboxed integrations (swap in production credentials)

| Capability | Current behaviour | Production hook |
|---|---|---|
| Payments | `POST /api/payments` settles locally (`verify`), supports `fail` and `refund` | Replace the settle step with Paystack/Flutterwave verify calls; the fee math, ledger rows and ticket release stay identical |
| Email / SMS / WhatsApp | `logMessage()` records every campaign with its audience and recipient count | Hand `recipients[]` to your provider inside `logMessage()` |
| WhatsApp / social share | Share links on the event page | — |
| Certificates | `issue_certificates` returns the list of admitted guests | Attach a PDF renderer + delivery |

## Product boundaries (deliberate)

- The public event page is **not** the organiser console: management lives behind
  `/events/[slug]/manage`, which is what the "Manage Event" buttons link to.
- Free events stay free on every plan — the 8% + ₦100 fee only applies to paid tickets.
- Currency formatting is naira-first (`en-NG`), ready for multi-currency expansion.
