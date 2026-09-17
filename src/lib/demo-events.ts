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

const IMAGES = [
  "/events/summit.jpg", "/events/workshop.jpg", "/events/tech-festival.jpg",
  "/events/convention.jpg", "/events/masterclass.jpg", "/events/startup-clinic.jpg",
];
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"];
const COLORS = ["#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#0891B2"];

export const DEMO_EVENTS: DemoEvent[] = Object.entries(CATALOGUE).flatMap(([category, titles], categoryIndex) =>
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
      totalRegistrations: 0,
      totalCheckins: 0,
      totalRevenue: "0",
      soldOut: false,
      requiresApproval: category === "private" || index === 2,
      organiserId: "demo-ueb-organiser",
      organisationId: "demo-ueb-organisation",
      organiserName: "UEB Community Organisers",
      organiserOrg: "Unique Events Booking",
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
