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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  description: text("description"),
  category: eventCategoryEnum("category").default("other"),
  type: eventTypeEnum("type").default("standard"),
  status: eventStatusEnum("status").default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  venue: varchar("venue", { length: 500 }),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  address: text("address"),
  virtualLink: text("virtual_link"),
  capacity: integer("capacity"),
  imageUrl: text("image_url"),
  bannerColor: varchar("banner_color", { length: 50 }).default("#7C3AED"),
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
  customAnswers: jsonb("custom_answers").$type<Record<string, string>>().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  invitationCode: varchar("invitation_code", { length: 100 }).unique(),
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
