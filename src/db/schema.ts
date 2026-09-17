import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "platform_admin",
  "org_admin",
  "event_owner",
  "event_staff",
  "checkin_staff",
  "finance_staff",
  "attendee",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "cancelled",
  "completed",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "standard",
  "recurring",
  "timeslot",
  "virtual",
  "hybrid",
]);

export const eventCategoryEnum = pgEnum("event_category", [
  "conference",
  "seminar",
  "workshop",
  "concert",
  "corporate",
  "university",
  "church",
  "government",
  "wedding",
  "networking",
  "training",
  "exhibition",
  "fundraising",
  "private",
  "other",
]);

export const ticketTypeEnum = pgEnum("ticket_type", [
  "free",
  "paid",
  "vip",
  "group",
  "invitation_only",
  "early_bird",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
  "on_hold",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  role: userRoleEnum("role").default("attendee").notNull(),
  accountStatus: varchar("account_status", { length: 30 }).default("approved").notNull(),
  organisation: varchar("organisation", { length: 255 }),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organisations = pgTable("organisations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  logo: text("logo"),
  website: text("website"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  city: varchar("city", { length: 100 }),
  ownerId: uuid("owner_id").references(() => users.id),
  followers: integer("followers").default(0),
  eventsHosted: integer("events_hosted").default(0),
  totalAttendees: integer("total_attendees").default(0),
  hostingSince: timestamp("hosting_since"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  /** Short subtitle shown under the title on the event page and cards. */
  tagline: varchar("tagline", { length: 300 }),
  description: text("description"),
  category: eventCategoryEnum("category").default("other"),
  type: eventTypeEnum("type").default("standard"),
  /** Eventbrite-style format facet: how people attend. */
  format: varchar("format", { length: 30 }).default("in_person"),
  status: eventStatusEnum("status").default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  timezone: varchar("timezone", { length: 60 }).default("Africa/Lagos"),
  venue: varchar("venue", { length: 500 }),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  address: text("address"),
  virtualLink: text("virtual_link"),
  capacity: integer("capacity"),
  imageUrl: text("image_url"),
  /** Extra hero images cycled behind the main one. */
  gallery: jsonb("gallery").$type<string[]>().default([]),
  bannerColor: varchar("banner_color", { length: 50 }).default("#7C3AED"),
  /** "Good to know" bullets, e.g. "You'll learn the pricing framework". */
  highlights: jsonb("highlights").$type<string[]>().default([]),
  /** FAQ accordion on the event page. */
  faqs: jsonb("faqs").$type<{ question: string; answer: string }[]>().default([]),
  ageRestriction: varchar("age_restriction", { length: 50 }),
  organiserId: uuid("organiser_id").references(() => users.id),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  requiresApproval: boolean("requires_approval").default(false),
  refundPolicy: text("refund_policy"),
  customConfirmationMessage: text("custom_confirmation_message"),
  customQuestions: jsonb("custom_questions").$type<CustomQuestion[]>().default([]),
  feeAbsorbedByOrganiser: boolean("fee_absorbed_by_organiser").default(false),
  totalRegistrations: integer("total_registrations").default(0),
  totalCheckins: integer("total_checkins").default(0),
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).default("0"),
  // Recurring events + appointment slots
  recurrenceRule: jsonb("recurrence_rule").$type<RecurrenceRule | null>(),
  seatSelectionEnabled: boolean("seat_selection_enabled").default(false),
  waitlistEnabled: boolean("waitlist_enabled").default(false),
  // Post-event activities
  postEventMessage: text("post_event_message"),
  surveyUrl: text("survey_url"),
  completedAt: timestamp("completed_at"),
  // Sales lifecycle
  soldOut: boolean("sold_out").default(false),
  soldOutAt: timestamp("sold_out_at"),
  listed: boolean("listed").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketTiers = pgTable("ticket_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: ticketTypeEnum("type").default("free"),
  price: decimal("price", { precision: 15, scale: 2 }).default("0"),
  quantity: integer("quantity"),
  quantitySold: integer("quantity_sold").default(0),
  groupSize: integer("group_size").default(1),
  saleStartDate: timestamp("sale_start_date"),
  saleEndDate: timestamp("sale_end_date"),
  isInvitationOnly: boolean("is_invitation_only").default(false),
  accessCode: varchar("access_code", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const registrations = pgTable("registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  ticketTierId: uuid("ticket_tier_id").references(() => ticketTiers.id),
  userId: uuid("user_id").references(() => users.id),
  attendeeName: varchar("attendee_name", { length: 255 }).notNull(),
  attendeeEmail: varchar("attendee_email", { length: 255 }).notNull(),
  attendeePhone: varchar("attendee_phone", { length: 50 }),
  organisation: varchar("organisation", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  status: registrationStatusEnum("status").default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").default("pending"),
  amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).default("0"),
  ticketNumber: varchar("ticket_number", { length: 100 }).unique(),
  qrCode: text("qr_code"),
  checkedIn: boolean("checked_in").default(false),
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: varchar("checked_in_by", { length: 255 }),
  customAnswers: jsonb("custom_answers").$type<Record<string, string>>().default({}),
  notes: text("notes"),
  // Group tickets
  quantity: integer("quantity").default(1),
  groupId: uuid("group_id"),
  isGroupLead: boolean("is_group_lead").default(true),
  guests: jsonb("guests").$type<string[]>().default([]),
  // Time-slot appointments
  slotId: uuid("slot_id"),
  slotLabel: varchar("slot_label", { length: 255 }),
  // Seating
  seatLabel: varchar("seat_label", { length: 100 }),
  seatId: uuid("seat_id"),
  // Ticketing lifecycle
  ticketIssuedAt: timestamp("ticket_issued_at"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  // Order book (Eventbrite-style orders: Tickets / Donations / Add-ons tabs)
  tab: varchar("tab", { length: 50 }).default("tickets"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).default("0"),
  attendeeTitle: varchar("attendee_title", { length: 20 }),
  ticketName: varchar("ticket_name", { length: 255 }),
  checkedInGuests: integer("checked_in_guests").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  invitationCode: varchar("invitation_code", { length: 100 }).unique(),
  tierId: uuid("tier_id"),
  maxGuests: integer("max_guests").default(1),
  notes: text("notes"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  registeredAt: timestamp("registered_at"),
  status: varchar("status", { length: 50 }).default("sent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  discountType: varchar("discount_type", { length: 50 }).default("percentage"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Recurring events ─────────────────────────────────────────
export const eventOccurrences = pgTable("event_occurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 255 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  capacity: integer("capacity"),
  seatsBooked: integer("seats_booked").default(0),
  status: varchar("status", { length: 50 }).default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Appointment / time-slot events ───────────────────────────
export const eventSlots = pgTable("event_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  occurrenceId: uuid("occurrence_id").references(() => eventOccurrences.id, { onDelete: "set null" }),
  label: varchar("label", { length: 255 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  capacity: integer("capacity").default(1),
  booked: integer("booked").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Vendors ──────────────────────────────────────────────────
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  stallNumber: varchar("stall_number", { length: 50 }),
  fee: decimal("fee", { precision: 15, scale: 2 }).default("0"),
  amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("invited"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Seating ──────────────────────────────────────────────────
export const seatingSections = pgTable("seating_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rows: integer("rows").default(0),
  seatsPerRow: integer("seats_per_row").default(0),
  tierName: varchar("tier_name", { length: 255 }),
  color: varchar("color", { length: 50 }).default("#7C3AED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seats = pgTable("seats", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  sectionId: uuid("section_id").references(() => seatingSections.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  rowName: varchar("row_name", { length: 20 }),
  seatNumber: integer("seat_number"),
  status: varchar("status", { length: 50 }).default("available"),
  registrationId: uuid("registration_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Payments ─────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).default("paystack"),
  channel: varchar("channel", { length: 50 }).default("card"),
  reference: varchar("reference", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 15, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("NGN"),
  status: varchar("status", { length: 50 }).default("initialized"),
  payerEmail: varchar("payer_email", { length: 255 }),
  paidAt: timestamp("paid_at"),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Communications ───────────────────────────────────────────
export const eventMessages = pgTable("event_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  channel: varchar("channel", { length: 50 }).default("email"),
  audience: varchar("audience", { length: 50 }).default("all"),
  subject: varchar("subject", { length: 500 }),
  body: text("body").notNull(),
  recipientCount: integer("recipient_count").default(0),
  status: varchar("status", { length: 50 }).default("sent"),
  senderName: varchar("sender_name", { length: 255 }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Check-in audit trail ─────────────────────────────────────
export const checkinLogs = pgTable("checkin_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  ticketNumber: varchar("ticket_number", { length: 100 }),
  result: varchar("result", { length: 50 }).notNull(),
  method: varchar("method", { length: 50 }).default("scan"),
  staffName: varchar("staff_name", { length: 255 }),
  device: varchar("device", { length: 255 }),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});

// ─── Post-event feedback & surveys ────────────────────────────
export const eventFeedback = pgTable("event_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  attendeeName: varchar("attendee_name", { length: 255 }),
  rating: integer("rating"),
  comment: text("comment"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// ─── Waitlist ─────────────────────────────────────────────────
export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  ticketTierId: uuid("ticket_tier_id").references(() => ticketTiers.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  status: varchar("status", { length: 50 }).default("waiting"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventStaff = pgTable("event_staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: userRoleEnum("role").default("checkin_staff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type CustomQuestion = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "number" | "dropdown" | "checkbox" | "date";
  required: boolean;
  options?: string[];
};

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  interval?: number;
  /** total number of occurrences to generate (including the first) */
  count?: number;
  /** ISO date string — stop generating after this date */
  until?: string | null;
  /** 0 = Sunday … 6 = Saturday, for weekly patterns */
  weekdays?: number[];
  /** HH:mm local time for each occurrence */
  time?: string;
  durationMinutes?: number;
};

export type EventMessageChannel = "email" | "sms" | "whatsapp" | "in_app";export type MessageAudience =
  | "all"
  | "approved"
  | "pending"
  | "on_hold"
  | "rejected"
  | "checked_in"
  | "not_checked_in"
  | "unpaid"
  | "vendors"
  | "waitlist";

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  registrations: many(registrations),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organiser: one(users, { fields: [events.organiserId], references: [users.id] }),
  organisation: one(organisations, { fields: [events.organisationId], references: [organisations.id] }),
  ticketTiers: many(ticketTiers),
  registrations: many(registrations),
  invitations: many(invitations),
  discountCodes: many(discountCodes),
  staff: many(eventStaff),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  event: one(events, { fields: [registrations.eventId], references: [events.id] }),
  ticketTier: one(ticketTiers, { fields: [registrations.ticketTierId], references: [ticketTiers.id] }),
  user: one(users, { fields: [registrations.userId], references: [users.id] }),
}));

export const ticketTiersRelations = relations(ticketTiers, ({ one, many }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
  registrations: many(registrations),
}));
