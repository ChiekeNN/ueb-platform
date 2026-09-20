import { slugify } from "@/lib/utils";

export type DemoTier = {
  id: string;
  name: string;
  price: string;
  type: "free" | "paid" | "vip";
};

export type DemoEvent = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  type: "standard";
  format: "in_person" | "online" | "hybrid";
  status: "published";
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  country: string;
  imageUrl: string;
  bannerColor: string;
  capacity: number;
  totalRegistrations: number;
  totalCheckins: number;
  totalRevenue: string;
  soldOut: boolean;
  requiresApproval: boolean;
  organiserId: string;
  organisationId: string;
  organiserName: string;
  organiserOrg: string;
  organiserFollowers: number;
  tiers: DemoTier[];
  highlights: string[];
  gallery: string[];
  faqs: { question: string; answer: string }[];
};

const CATALOGUE: Record<string, string[]> = {
  conference: [
    "Lagos Future Cities Conference", "Africa Product Leaders Conference", "West Africa Health Conference",
    "Sustainable Business Conference", "Women in Enterprise Conference", "Creative Economy Conference",
  ],
  seminar: [
    "Personal Finance Seminar", "Export Readiness Seminar", "Digital Marketing Seminar",
    "Public Speaking Seminar", "Data Literacy Seminar", "Workplace Wellness Seminar",
  ],
  workshop: [
    "No-Code Product Workshop", "Brand Strategy Workshop", "Project Management Workshop",
    "Food Business Workshop", "Frontend Engineering Workshop", "Grant Writing Workshop",
  ],
  concert: [
    "Lagos Live Sessions", "Afrobeats Sunset Concert", "Jazz by the Lagoon",
    "Northern Sounds Live", "Indie Night Lagos", "Praise & Culture Concert",
  ],
  corporate: [
    "Annual Strategy Offsite", "Customer Experience Forum", "People & Culture Summit",
    "Finance Leaders Roundtable", "Sales Excellence Bootcamp", "Boardroom Breakfast",
  ],
  university: [
    "Campus Innovation Fair", "Alumni Homecoming", "Student Research Showcase",
    "University Debate Open", "Freshers Welcome Week", "Interfaculty Games",
  ],
  church: [
    "Lagos Worship Night", "Young Adults Retreat", "Women of Purpose Conference",
    "Men of Faith Breakfast", "Family Life Weekend", "Community Outreach Day",
  ],
  government: [
    "Public Service Innovation Forum", "Lagos SME Policy Dialogue", "Open Data Stakeholder Forum",
    "Climate Resilience Roundtable", "Citizen Engagement Town Hall", "Local Government Leadership Forum",
  ],
  wedding: [
    "Ada & Tobi Wedding Celebration", "Chinwe & Kelechi Traditional Wedding", "Maya & Femi White Wedding",
    "Sade & Dapo Engagement Party", "Amaka & Chinedu Garden Wedding", "Zainab & Ibrahim Nikah",
  ],
  networking: [
    "Founders & Funders Mixer", "Lagos Product People Meetup", "Women Build Africa Mixer",
    "Creative Professionals Social", "Diaspora Connect Nigeria", "Real Estate Leaders Mixer",
  ],
  training: [
    "Excel for Business Training", "Leadership Essentials Training", "Cybersecurity Awareness Training",
    "Customer Service Training", "Financial Modelling Training", "First Aid at Work Training",
  ],
  exhibition: [
    "Lagos Art & Design Exhibition", "Made in Nigeria Trade Fair", "Photography Open Showcase",
    "Future Mobility Exhibition", "Food & Culture Market", "African Design Week",
  ],
  fundraising: [
    "Run for Education", "Community Health Benefit", "Children's Scholarship Dinner",
    "Creative Arts Fundraiser", "Food Bank Giving Day", "Climate Action Fundraiser",
  ],
  private: [
    "Executive Dinner Series", "Invite-Only Founder Circle", "Private Film Screening",
    "Family Heritage Celebration", "Collectors Preview Night", "Members Garden Party",
  ],
  other: [
    "Lagos Community Day", "Saturday Makers Market", "New Beginnings Meetup",
    "The Local Experience", "Ideas Worth Sharing", "Open Mic & Stories",
  ],
};

export const DEMO_POSTERS = [
  "/events/poster-01.svg", "/events/poster-02.svg", "/events/poster-03.svg",
  "/events/poster-04.svg", "/events/poster-05.svg", "/events/poster-06.svg",
  "/events/poster-07.svg", "/events/poster-08.svg", "/events/poster-09.svg",
  "/events/poster-10.svg", "/events/poster-11.svg", "/events/poster-12.svg",
];

const IMAGES = DEMO_POSTERS;
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"];
const COLORS = ["#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#0891B2"];
const DEMO_ORGANISERS = [
  { name: "Chidi Okonkwo", organisation: "Harbourlight Events" },
  { name: "Amara Nwosu", organisation: "Mango Tree Collective" },
  { name: "Tolu Adebayo", organisation: "Northstar Growth Partners" },
  { name: "Zainab Bello", organisation: "Cedar House Projects" },
  { name: "Emeka Nnamani", organisation: "Riverside Experiences" },
  { name: "Adaeze Eze", organisation: "Brightline Culture Studio" },
  { name: "Femi Balogun", organisation: "The Foundry Network" },
  { name: "Nneka Ibe", organisation: "Coastal Creative Co." },
];

function organiserFor(eventTitle: string) {
  const index = [...eventTitle].reduce((total, character) => total + character.charCodeAt(0), 0) % DEMO_ORGANISERS.length;
  return DEMO_ORGANISERS[index];
}

type PlannedEventSeed = {
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  city: string;
  venue: string;
  imageUrl: string;
  bannerColor: string;
  capacity: number;
  totalRegistrations: number;
};

/** Additional dated events used to keep the preview catalogue useful across the next four months. */
export const PLANNED_EVENT_SEEDS: PlannedEventSeed[] = [
  // October 2026 — 5 events
  { title: "Lagos Tech Careers Expo", category: "university", startDate: "2026-10-05T10:00:00+01:00", endDate: "2026-10-05T17:00:00+01:00", city: "Lagos", venue: "Landmark Centre", imageUrl: "/events/careers-day.jpg", bannerColor: "#2563EB", capacity: 900, totalRegistrations: 37 },
  { title: "Nigeria Creative Market", category: "exhibition", startDate: "2026-10-10T10:00:00+01:00", endDate: "2026-10-11T18:00:00+01:00", city: "Lagos", venue: "Federal Palace Hotel", imageUrl: "/events/workshop.jpg", bannerColor: "#D97706", capacity: 650, totalRegistrations: 84 },
  { title: "Women in Business Networking Night", category: "networking", startDate: "2026-10-15T18:00:00+01:00", endDate: "2026-10-15T22:00:00+01:00", city: "Abuja", venue: "The Wells Carlton", imageUrl: "/events/summit.jpg", bannerColor: "#DB2777", capacity: 240, totalRegistrations: 126 },
  { title: "Abuja Product Management Workshop", category: "workshop", startDate: "2026-10-22T09:00:00+01:00", endDate: "2026-10-22T16:00:00+01:00", city: "Abuja", venue: "Ceddi Plaza", imageUrl: "/events/masterclass.jpg", bannerColor: "#7C3AED", capacity: 180, totalRegistrations: 59 },
  { title: "Afrobeats Live October", category: "concert", startDate: "2026-10-29T18:00:00+01:00", endDate: "2026-10-29T23:00:00+01:00", city: "Lagos", venue: "Muri Okunola Park", imageUrl: "/events/tech-festival.jpg", bannerColor: "#DC2626", capacity: 3200, totalRegistrations: 213 },
  // November 2026 — 5 events
  { title: "Africa Climate Action Summit", category: "conference", startDate: "2026-11-05T09:00:00+01:00", endDate: "2026-11-06T17:00:00+01:00", city: "Lagos", venue: "Eko Convention Centre", imageUrl: "/events/summit.jpg", bannerColor: "#059669", capacity: 1200, totalRegistrations: 72 },
  { title: "Lagos Wedding & Lifestyle Fair", category: "wedding", startDate: "2026-11-12T10:00:00+01:00", endDate: "2026-11-15T18:00:00+01:00", city: "Lagos", venue: "The Balmoral Convention Centre", imageUrl: "/events/convention.jpg", bannerColor: "#DB2777", capacity: 1800, totalRegistrations: 148 },
  { title: "Startup Funding Clinic", category: "training", startDate: "2026-11-18T09:00:00+01:00", endDate: "2026-11-18T16:00:00+01:00", city: "Lagos", venue: "The Zone Tech Park", imageUrl: "/events/startup-clinic.jpg", bannerColor: "#0891B2", capacity: 300, totalRegistrations: 301 },
  { title: "Digital Skills Bootcamp", category: "training", startDate: "2026-11-24T09:00:00+01:00", endDate: "2026-11-27T17:00:00+01:00", city: "Port Harcourt", venue: "Civic Centre", imageUrl: "/events/careers-day.jpg", bannerColor: "#2563EB", capacity: 500, totalRegistrations: 91 },
  { title: "Community Health Outreach", category: "church", startDate: "2026-11-29T08:00:00+01:00", endDate: "2026-11-29T16:00:00+01:00", city: "Ibadan", venue: "Lekki Community Field", imageUrl: "/events/convention.jpg", bannerColor: "#16A34A", capacity: 700, totalRegistrations: 177 },
  // December 2026 — 7 events
  { title: "Lagos Food & Culture Festival", category: "exhibition", startDate: "2026-12-03T11:00:00+01:00", endDate: "2026-12-06T20:00:00+01:00", city: "Lagos", venue: "Muri Okunola Park", imageUrl: "/events/workshop.jpg", bannerColor: "#D97706", capacity: 2400, totalRegistrations: 44 },
  { title: "End-of-Year Gospel Concert", category: "church", startDate: "2026-12-06T16:00:00+01:00", endDate: "2026-12-06T22:00:00+01:00", city: "Lagos", venue: "Eko Hotel Grounds", imageUrl: "/events/convention.jpg", bannerColor: "#7C3AED", capacity: 4500, totalRegistrations: 265 },
  { title: "Abuja Business Leaders Dinner", category: "corporate", startDate: "2026-12-12T18:00:00+01:00", endDate: "2026-12-12T23:00:00+01:00", city: "Abuja", venue: "Transcorp Hilton", imageUrl: "/events/summit.jpg", bannerColor: "#0F766E", capacity: 180, totalRegistrations: 118 },
  { title: "Christmas Makers Market", category: "exhibition", startDate: "2026-12-18T10:00:00+01:00", endDate: "2026-12-20T19:00:00+01:00", city: "Lagos", venue: "Harbour Point", imageUrl: "/events/workshop.jpg", bannerColor: "#DC2626", capacity: 1400, totalRegistrations: 332 },
  { title: "Family Fun Day Lagos", category: "other", startDate: "2026-12-20T10:00:00+01:00", endDate: "2026-12-20T18:00:00+01:00", city: "Lagos", venue: "Tafawa Balewa Square", imageUrl: "/events/careers-day.jpg", bannerColor: "#F59E0B", capacity: 2600, totalRegistrations: 67 },
  { title: "Year-End Photography Exhibition", category: "exhibition", startDate: "2026-12-27T12:00:00+01:00", endDate: "2026-12-30T19:00:00+01:00", city: "Lagos", venue: "Alliance Française", imageUrl: "/events/masterclass.jpg", bannerColor: "#4F46E5", capacity: 400, totalRegistrations: 204 },
  { title: "New Year Vision Board Workshop", category: "workshop", startDate: "2026-12-30T10:00:00+01:00", endDate: "2026-12-30T15:00:00+01:00", city: "Abuja", venue: "The Foundry", imageUrl: "/events/workshop.jpg", bannerColor: "#0891B2", capacity: 120, totalRegistrations: 153 },
  // January 2027 — 10 events
  { title: "New Year Career Fair", category: "university", startDate: "2027-01-06T10:00:00+01:00", endDate: "2027-01-06T17:00:00+01:00", city: "Lagos", venue: "Landmark Centre", imageUrl: "/events/careers-day.jpg", bannerColor: "#2563EB", capacity: 1500, totalRegistrations: 389 },
  { title: "Africa Innovation Summit", category: "conference", startDate: "2027-01-09T09:00:00+01:00", endDate: "2027-01-10T18:00:00+01:00", city: "Lagos", venue: "Eko Convention Centre", imageUrl: "/events/tech-festival.jpg", bannerColor: "#7C3AED", capacity: 2000, totalRegistrations: 102 },
  { title: "Personal Finance Reset Seminar", category: "seminar", startDate: "2027-01-14T10:00:00+01:00", endDate: "2027-01-14T15:00:00+01:00", city: "Abuja", venue: "NAF Conference Centre", imageUrl: "/events/masterclass.jpg", bannerColor: "#059669", capacity: 350, totalRegistrations: 241 },
  { title: "Frontend Engineering Bootcamp", category: "training", startDate: "2027-01-18T09:00:00+01:00", endDate: "2027-01-22T17:00:00+01:00", city: "Lagos", venue: "TechCabal Campus", imageUrl: "/events/tech-festival.jpg", bannerColor: "#2563EB", capacity: 280, totalRegistrations: 76 },
  { title: "Lagos Fitness & Wellness Day", category: "other", startDate: "2027-01-21T07:00:00+01:00", endDate: "2027-01-21T15:00:00+01:00", city: "Lagos", venue: "Muri Okunola Park", imageUrl: "/events/careers-day.jpg", bannerColor: "#16A34A", capacity: 600, totalRegistrations: 315 },
  { title: "Founders & Funders Mixer", category: "networking", startDate: "2027-01-23T17:00:00+01:00", endDate: "2027-01-23T22:00:00+01:00", city: "Lagos", venue: "The Wheatbaker", imageUrl: "/events/startup-clinic.jpg", bannerColor: "#0891B2", capacity: 260, totalRegistrations: 167 },
  { title: "University Research Showcase", category: "university", startDate: "2027-01-26T10:00:00+01:00", endDate: "2027-01-26T17:00:00+01:00", city: "Port Harcourt", venue: "University Auditorium", imageUrl: "/events/careers-day.jpg", bannerColor: "#4F46E5", capacity: 800, totalRegistrations: 428 },
  { title: "Wedding Planning Expo", category: "wedding", startDate: "2027-01-28T10:00:00+01:00", endDate: "2027-01-29T18:00:00+01:00", city: "Lagos", venue: "Federal Palace Hotel", imageUrl: "/events/convention.jpg", bannerColor: "#DB2777", capacity: 1200, totalRegistrations: 56 },
  { title: "Creative Writing Retreat", category: "workshop", startDate: "2027-01-30T09:00:00+01:00", endDate: "2027-02-01T16:00:00+01:00", city: "Ibadan", venue: "Aare House", imageUrl: "/events/masterclass.jpg", bannerColor: "#D97706", capacity: 90, totalRegistrations: 287 },
  { title: "Public Service Leadership Forum", category: "government", startDate: "2027-01-31T09:00:00+01:00", endDate: "2027-01-31T17:00:00+01:00", city: "Abuja", venue: "International Conference Centre", imageUrl: "/events/summit.jpg", bannerColor: "#0F766E", capacity: 700, totalRegistrations: 133 },
];

function toDemoEvent(seed: PlannedEventSeed): DemoEvent {
  const slug = `planned-${slugify(seed.title)}`;
  const organiser = organiserFor(seed.title);
  return {
    id: slug,
    title: seed.title,
    slug,
    tagline: `${seed.category[0].toUpperCase()}${seed.category.slice(1)} experiences curated for Nigeria's next generation of organisers and communities.`,
    description: `Join this UEB ${seed.category} event for practical sessions, trusted connections and an experience designed around the people in the room.`,
    category: seed.category,
    type: "standard",
    format: "in_person",
    status: "published",
    startDate: seed.startDate,
    endDate: seed.endDate,
    venue: seed.venue,
    city: seed.city,
    country: "Nigeria",
    imageUrl: seed.imageUrl,
    bannerColor: seed.bannerColor,
    capacity: seed.capacity,
    totalRegistrations: seed.totalRegistrations,
    totalCheckins: 0,
    totalRevenue: "0",
    soldOut: false,
    requiresApproval: false,
    organiserId: "demo-ueb-organiser",
    organisationId: "demo-ueb-organisation",
    organiserName: organiser.name,
    organiserOrg: organiser.organisation,
    organiserFollowers: 4187,
    tiers: [{ id: `${slug}-general`, name: "General Admission", price: "0", type: "free" }],
    highlights: ["Branded registration and digital ticketing on UEB", "Connect with attendees, speakers and partners", "QR check-in and live attendance tracking"],
    gallery: [seed.imageUrl],
    faqs: [],
  };
}

const PLANNED_DEMO_EVENTS = PLANNED_EVENT_SEEDS.map(toDemoEvent);

const CATALOGUE_EVENTS: DemoEvent[] = Object.entries(CATALOGUE).flatMap(([category, titles], categoryIndex) =>
  titles.map((title, index) => {
    const online = index === 4;
    const hybrid = index === 5;
    const city = online ? "Online" : CITIES[(categoryIndex + index) % CITIES.length];
    const start = new Date();
    start.setDate(start.getDate() + 14 + categoryIndex * 3 + index * 4);
    start.setHours(9 + (index % 5), 0, 0, 0);
    const slug = `demo-${slugify(title)}`;
    const price = index % 3 === 0 ? "0" : String(5000 + ((categoryIndex + index) % 6) * 2500);
    const imageUrl = IMAGES[(categoryIndex + index) % IMAGES.length];
    const organiser = organiserFor(title);

    return {
      id: slug,
      title,
      slug,
      tagline: `${category[0].toUpperCase()}${category.slice(1)} experiences curated for Nigeria's next generation of organisers and communities.`,
      description: `Join this UEB ${category} event for practical sessions, trusted connections and an experience designed around the people in the room.`,
      category,
      type: "standard",
      format: online ? "online" : hybrid ? "hybrid" : "in_person",
      status: "published",
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + (index % 2 === 0 ? 8 : 4) * 60 * 60 * 1000).toISOString(),
      venue: online ? "UEB Live" : `${city} Event Centre`,
      city,
      country: "Nigeria",
      imageUrl,
      bannerColor: COLORS[(categoryIndex + index) % COLORS.length],
      capacity: 120 + index * 80 + categoryIndex * 20,
      // Stable demo engagement numbers keep the upcoming cards feeling alive
      // without changing on every render or pretending these are live bookings.
      totalRegistrations: 24 + ((categoryIndex * 61 + index * 37) % 470),
      totalCheckins: 0,
      totalRevenue: "0",
      soldOut: false,
      requiresApproval: category === "private" || index === 2,
      organiserId: "demo-ueb-organiser",
      organisationId: "demo-ueb-organisation",
      organiserName: organiser.name,
      organiserOrg: organiser.organisation,
      organiserFollowers: 4187,
      tiers: [{
        id: `${slug}-general`,
        name: price === "0" ? "Free Registration" : "General Admission",
        price,
        type: price === "0" ? "free" : "paid",
      }],
      highlights: [
        "Branded registration and digital ticketing on UEB",
        "Connect with attendees, speakers and partners",
        "QR check-in and live attendance tracking",
      ],
      gallery: [imageUrl],
      faqs: [],
    };
  }),
);

export const DEMO_EVENTS: DemoEvent[] = [...CATALOGUE_EVENTS, ...PLANNED_DEMO_EVENTS];

export function findDemoEvent(slug: string): DemoEvent | undefined {
  return DEMO_EVENTS.find((event) => event.slug === slug);
}

export function filterDemoEvents(params: URLSearchParams): DemoEvent[] {
  const category = params.get("category");
  const city = params.get("city");
  const format = params.get("format");
  const search = params.get("search")?.trim().toLowerCase();
  const price = params.get("price");
  const sort = params.get("sort") ?? "date";

  return [...DEMO_EVENTS]
    .filter((event) => !category || category === "all" || event.category === category)
    .filter((event) => !city || city === "all" || event.city.toLowerCase().includes(city.toLowerCase()))
    .filter((event) => !format || format === "all" || event.format === format)
    .filter((event) => !search || [event.title, event.city, event.venue, event.organiserOrg].some((value) => value.toLowerCase().includes(search)))
    .filter((event) => price !== "free" || event.tiers.some((tier) => Number(tier.price) === 0))
    .filter((event) => price !== "paid" || event.tiers.every((tier) => Number(tier.price) > 0))
    .sort((a, b) => sort === "newest" ? b.title.localeCompare(a.title) : a.startDate.localeCompare(b.startDate));
}
