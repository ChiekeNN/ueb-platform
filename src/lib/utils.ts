import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number | string, currency = "NGN"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₦0";
  if (currency === "NGN") {
    return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return num.toLocaleString("en-US", { style: "currency", currency });
}

/** "Fri, Nov 17, 8:30 AM" — the compact card format used across discovery. */
export function eventDateShort(date: Date | string | null | undefined): string {
  if (!date) return "Date TBA";
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${day}, ${rest}, ${formatTimeCompact(d)}`;
}

export function formatTimeCompact(d: Date): string {
  const minutes = d.getMinutes();
  const hour12 = d.getHours() % 12 || 12;
  const suffix = d.getHours() >= 12 ? "PM" : "AM";
  return minutes === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "Thursday, September 17 • 6:30 PM - 8 PM" — the event page date line. */
export function eventDateLine(start: Date | string | null | undefined, end?: Date | string | null): string {
  if (!start) return "Date and time to be announced";
  const s = typeof start === "string" ? new Date(start) : start;
  const weekday = s.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = s.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  let line = `${weekday}, ${dayMonth} • ${formatTimeCompact(s)}`;
  if (end) {
    const e = typeof end === "string" ? new Date(end) : end;
    line += ` - ${formatTimeCompact(e)}`;
  }
  return line;
}

/** "Thu, Nov 5, 10:00 AM + 1 more" — used when an event repeats. */
export function eventDateWithMore(date: Date | string | null | undefined, extraCount: number): string {
  const base = eventDateShort(date);
  return extraCount > 0 ? `${base} + ${extraCount} more` : base;
}

export function formatTimeRange(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start) return "";
  const s = typeof start === "string" ? new Date(start) : start;
  const out = formatTimeCompact(s);
  if (!end) return out;
  const e = typeof end === "string" ? new Date(end) : end;
  return `${out} - ${formatTimeCompact(e)}`;
}

/** Human duration: "1 hour 30 minutes", "3 days". */
export function formatDuration(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start || !end) return "";
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  if (mins <= 0) return "";
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes && !days) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(" ");
}

export type PriceSummary = { label: string; free: boolean; minPrice: number; maxPrice: number };

/**
 * Price label for discovery cards:
 * "Free" · "From ₦15,000" · "₦25,000" — free wins when any tier is free.
 */
export function priceSummaryLabel(tiers: { price: string | number | null; type?: string | null }[]): PriceSummary {
  const prices = tiers.map((t) => Number(t.price ?? 0)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return { label: "Registration required", free: true, minPrice: 0, maxPrice: 0 };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === 0) return { label: "Free", free: true, minPrice: 0, maxPrice: max };
  const label = min === max ? formatCurrency(min) : `From ${formatCurrency(min)}`;
  return { label, free: false, minPrice: min, maxPrice: max };
}

/** "Lagos · Landmark Centre" — the location line on cards and the event page. */
export function locationLine(city?: string | null, venue?: string | null, format?: string | null): string {
  if (format === "online") return "Online event";
  return [city, venue].filter(Boolean).join(" · ") || "Location to be announced";
}

export const EVENT_FORMATS = [
  { value: "in_person", label: "In-person", icon: "📍" },
  { value: "online", label: "Online", icon: "💻" },
  { value: "hybrid", label: "Hybrid", icon: "🌐" },
] as const;

export function formatLabel(format?: string | null): string {
  return EVENT_FORMATS.find((f) => f.value === format)?.label ?? "In-person";
}

/** Relative countdown used on the floating action bar: "Starts in 3 days". */
export function timeUntil(date: Date | string | null | undefined): string {
  if (!date) return "";
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  const scale = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const value = mins < 60 ? scale(mins, "minute") : hours < 36 ? scale(hours, "hour") : scale(days, "day");
  return diff >= 0 ? `Starts in ${value}` : `Ended ${value} ago`;
}

/** Number of distinct days represented in a list of session/slot dates. */
export function distinctDayCount(dates: (Date | string | null | undefined)[]): number {
  const set = new Set(
    dates.filter((d): d is Date | string => !!d).map((d) => new Date(d).toISOString().slice(0, 10))
  );
  return set.size;
}

export const UEB_PERCENT_FEE = 0.08;
export const UEB_FLAT_FEE = 100;

export function calculateUEBFee(ticketPrice: number): number {
  return Math.round(ticketPrice * UEB_PERCENT_FEE + UEB_FLAT_FEE);
}

/** Full money breakdown for a ticket: what the attendee pays, what UEB keeps, what the organiser receives. */
export function feeBreakdown(unitPrice: number, quantity = 1, feeAbsorbedByOrganiser = false) {
  const subtotal = unitPrice * quantity;
  const processing = subtotal > 0 ? Math.round(subtotal * UEB_PERCENT_FEE + UEB_FLAT_FEE * quantity) : 0;
  const total = feeAbsorbedByOrganiser ? subtotal : subtotal + processing;
  const organiserNet = feeAbsorbedByOrganiser ? subtotal - processing : subtotal;
  return {
    subtotal,
    processing,
    total,
    organiserNet: Math.max(organiserNet, 0),
    uebRevenue: processing,
  };
}

export function generatePaymentReference(prefix = "UEB"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function generateInvitationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "INV-";
  for (let i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/* ─── Recurring events ─────────────────────────────────────── */

export type RecurrenceRuleInput = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  interval?: number;
  count?: number;
  until?: string | null;
  weekdays?: number[];
  time?: string;
  durationMinutes?: number;
};

/**
 * Expands a recurrence rule into concrete occurrence dates.
 * The first occurrence is seeded from `startDate` (plus the rule's time-of-day when given).
 */
export function expandRecurrence(
  startDate: Date,
  rule: RecurrenceRuleInput,
  maxOccurrences = 60
): { start: Date; end: Date }[] {
  const interval = Math.max(1, rule.interval ?? 1);
  const requested = Math.min(Math.max(rule.count ?? 10, 1), maxOccurrences);
  const until = rule.until ? new Date(rule.until) : null;
  const durationMs = (rule.durationMinutes ?? 120) * 60 * 1000;

  const base = new Date(startDate);
  if (rule.time) {
    const [h, m] = rule.time.split(":").map((n) => parseInt(n, 10));
    if (!Number.isNaN(h)) base.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  }

  const out: { start: Date; end: Date }[] = [];
  const push = (d: Date) => {
    const end = new Date(d.getTime() + durationMs);
    out.push({ start: new Date(d), end });
  };

  if (rule.frequency === "weekly" && rule.weekdays && rule.weekdays.length > 0) {
    // Walk day-by-day from the start (limited to 2 years) collecting the selected weekdays.
    const cursor = new Date(base);
    cursor.setDate(cursor.getDate() - 0); // start on the seed date
    const limit = new Date(base);
    limit.setFullYear(limit.getFullYear() + 2);
    let weekIndex = 0;
    const firstWeekStart = new Date(base);
    firstWeekStart.setHours(0, 0, 0, 0);
    firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekStart.getDay());

    while (out.length < requested && cursor <= limit) {
      const weekStart = new Date(cursor);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekIndex = Math.round((weekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 3600 * 1000));
      const onIntervalWeek = weekIndex % interval === 0;
      const isSelectedDay = rule.weekdays.includes(cursor.getDay());
      const afterSeed = cursor >= base || sameDay(cursor, base);
      if (onIntervalWeek && isSelectedDay && afterSeed) push(cursor);
      if (until && cursor > until) break;
      cursor.setDate(cursor.getDate() + 1);
      if (out.length >= requested) break;
    }
    return out;
  }

  const cursor = new Date(base);
  for (let i = 0; i < requested; i++) {
    if (until && cursor > until) break;
    push(cursor);
    if (rule.frequency === "daily") cursor.setDate(cursor.getDate() + interval);
    else if (rule.frequency === "weekly") cursor.setDate(cursor.getDate() + 7 * interval);
    else if (rule.frequency === "biweekly") cursor.setDate(cursor.getDate() + 14 * interval);
    else cursor.setMonth(cursor.getMonth() + interval);
  }
  return out;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function describeRecurrence(rule: RecurrenceRuleInput | null | undefined): string {
  if (!rule) return "One-off event";
  const every = (n: number, unit: string) => (n <= 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const on = rule.weekdays?.length ? ` on ${rule.weekdays.map((d) => weekdays[d]).join(", ")}` : "";
  let base = "";
  if (rule.frequency === "daily") base = every(rule.interval ?? 1, "day");
  else if (rule.frequency === "weekly") base = every(rule.interval ?? 1, "week");
  else if (rule.frequency === "biweekly") base = "Every 2 weeks";
  else base = every(rule.interval ?? 1, "month");
  const ends = rule.until ? ` · until ${formatDate(rule.until)}` : rule.count ? ` · ${rule.count} occurrences` : "";
  return `${base}${on}${ends}`;
}

/* ─── Slots (appointment / time-slot events) ───────────────── */

export function expandSlots(
  day: Date,
  opts: { startTime: string; endTime: string; durationMinutes: number; capacity?: number }
): { start: Date; end: Date }[] {
  const [sh, sm] = opts.startTime.split(":").map(Number);
  const [eh, em] = opts.endTime.split(":").map(Number);
  const start = new Date(day);
  start.setHours(sh || 0, sm || 0, 0, 0);
  const end = new Date(day);
  end.setHours(eh || 0, em || 0, 0, 0);
  const step = Math.max(5, opts.durationMinutes) * 60 * 1000;
  const out: { start: Date; end: Date }[] = [];
  for (let t = start.getTime(); t + step <= end.getTime() + 1; t += step) {
    out.push({ start: new Date(t), end: new Date(t + step) });
    if (out.length > 96) break;
  }
  return out;
}

/* ─── Seating ──────────────────────────────────────────────── */

export function seatLabels(rows: number, seatsPerRow: number, sectionName: string) {
  const labels: { label: string; rowName: string; seatNumber: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const rowName = rowLetter(r);
    for (let s = 1; s <= seatsPerRow; s++) {
      labels.push({ label: `${sectionName} ${rowName}${s}`, rowName, seatNumber: s });
    }
  }
  return labels;
}

export function rowLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/* ─── CSV export ───────────────────────────────────────────── */

export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
}

export const MESSAGE_AUDIENCES = [
  { value: "all", label: "Everyone who registered" },
  { value: "approved", label: "Approved attendees" },
  { value: "pending", label: "Pending approval" },
  { value: "on_hold", label: "On hold" },
  { value: "rejected", label: "Rejected" },
  { value: "checked_in", label: "Checked in" },
  { value: "not_checked_in", label: "Not yet checked in" },
  { value: "unpaid", label: "Unpaid / payment pending" },
  { value: "vendors", label: "Vendors" },
  { value: "waitlist", label: "Waitlist" },
];

export const MESSAGE_CHANNELS = [
  { value: "email", label: "Email", icon: "✉️" },
  { value: "sms", label: "SMS", icon: "📲" },
  { value: "whatsapp", label: "WhatsApp", icon: "💬" },
  { value: "in_app", label: "In-app notice", icon: "🔔" },
];

export const VENDOR_CATEGORIES = [
  "Food & Beverage", "Merchandise", "Photography", "AV & Production",
  "Security", "Decor", "Logistics", "Media", "Sponsor", "Other",
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateTicketNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "UEB-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "TBD";
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    on_hold: "bg-orange-100 text-orange-800",
    cancelled: "bg-gray-100 text-gray-800",
    draft: "bg-gray-100 text-gray-700",
    published: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-purple-100 text-purple-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export const EVENT_CATEGORIES = [
  { value: "conference", label: "Conference" },
  { value: "seminar", label: "Seminar" },
  { value: "workshop", label: "Workshop" },
  { value: "concert", label: "Concert" },
  { value: "corporate", label: "Corporate" },
  { value: "university", label: "University" },
  { value: "church", label: "Church" },
  { value: "government", label: "Government" },
  { value: "wedding", label: "Wedding" },
  { value: "networking", label: "Networking" },
  { value: "training", label: "Training" },
  { value: "exhibition", label: "Exhibition" },
  { value: "fundraising", label: "Fundraising" },
  { value: "private", label: "Private" },
  { value: "other", label: "Other" },
];

export const BANNER_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626",
  "#D97706", "#0891B2", "#BE185D", "#1D4ED8",
  "#065F46", "#7C2D12",
];
