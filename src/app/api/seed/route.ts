import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  ticketTiers,
  registrations,
  users,
  organisations,
  eventSlots,
  eventOccurrences,
  seatingSections,
  seats,
  vendors,
  eventMessages,
  eventFeedback,
  payments,
  checkinLogs,
  type RecurrenceRule,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { expandRecurrence, expandSlots, generatePaymentReference, generateTicketNumber, seatLabels, slugify } from "@/lib/utils";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { hashPassword } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  try {
    // Create demo users
    const existingUsers = await db.select().from(users).where(eq(users.email, "admin@ueb.ng")).limit(1);
    let adminUser;
    if (existingUsers.length === 0) {
      [adminUser] = await db.insert(users).values([
        { name: "UEB Admin", email: "admin@ueb.ng", passwordHash: await hashPassword("admin1234"), role: "platform_admin", accountStatus: "approved", organisation: "Unique Events Booking" },
        { name: "Chidi Okonkwo", email: "chidi@upec.edu.ng", passwordHash: await hashPassword("organizer1234"), role: "event_owner", accountStatus: "approved", organisation: "UPEC University" },
        { name: "Amara Nwosu", email: "amara@abccorp.ng", passwordHash: await hashPassword("organizer1234"), role: "event_owner", accountStatus: "approved", organisation: "ABC Corporation" },
        { name: "UEB Subscriber", email: "subscriber@ueb.ng", passwordHash: await hashPassword("subscriber1234"), role: "attendee", accountStatus: "approved" },
      ]).returning();
    } else {
      adminUser = existingUsers[0];
    }

    // Keep the preview accounts usable after a database has already been seeded.
    await db.update(users).set({ passwordHash: await hashPassword("admin1234"), accountStatus: "approved" }).where(eq(users.email, "admin@ueb.ng"));
    await db.update(users).set({ passwordHash: await hashPassword("organizer1234"), accountStatus: "approved" }).where(eq(users.email, "chidi@upec.edu.ng"));
    await db.update(users).set({ passwordHash: await hashPassword("organizer1234"), accountStatus: "approved" }).where(eq(users.email, "amara@abccorp.ng"));
    const [subscriberUser] = await db.select().from(users).where(eq(users.email, "subscriber@ueb.ng")).limit(1);
    if (!subscriberUser) await db.insert(users).values({ name: "UEB Subscriber", email: "subscriber@ueb.ng", passwordHash: await hashPassword("subscriber1234"), role: "attendee", accountStatus: "approved" });

    /* ── Organisations (the "By …" card on every event page) ── */
    const orgSeeds = [
      {
        name: "Unique Events Booking Ltd",
        slug: "unique-events-booking",
        description: "Nigeria's event operating company — conferences, summits and corporate gatherings across West Africa.",
        email: "hello@ueb.ng",
        city: "Lagos",
        followers: 4187,
        eventsHosted: 96,
        totalAttendees: 41200,
        isVerified: true,
      },
      {
        name: "UPEC University",
        slug: "upec-university",
        description: "University events office: careers fairs, guest lectures, alumni meet-ups and student conferences.",
        email: "events@upec.edu.ng",
        city: "Lagos",
        followers: 1236,
        eventsHosted: 58,
        totalAttendees: 18900,
        isVerified: true,
      },
      {
        name: "ABC Corporation",
        slug: "abc-corporation",
        description: "Corporate training and leadership development partner for West African enterprises.",
        email: "training@abccorp.ng",
        city: "Abuja",
        followers: 742,
        eventsHosted: 24,
        totalAttendees: 5300,
        isVerified: false,
      },
    ];

    const orgs: (typeof organisations.$inferSelect)[] = [];
    for (const o of orgSeeds) {
      const existing = await db.select().from(organisations).where(eq(organisations.slug, o.slug)).limit(1);
      if (existing.length > 0) {
        orgs.push(existing[0]);
      } else {
        const [created] = await db.insert(organisations).values({
          ...o,
          ownerId: adminUser.id,
          hostingSince: new Date(Date.now() - 900 * 24 * 3600 * 1000),
        }).returning();
        orgs.push(created);
      }
    }

    const demoEvents = [
      {
        title: "Annual Entrepreneurship Summit 2027",
        tagline: "Three days of keynotes, workshops and investor matchmaking for African founders.",
        imageUrl: "/events/summit.jpg",
        gallery: ["/events/summit.jpg", "/events/tech-festival.jpg"],
        format: "in_person" as const,
        highlights: [
          "3 days of keynotes, workshops and curated networking",
          "Investor matchmaking with 40+ funds active in Africa",
          "Pitch arena with ₦10m in non-dilutive grants",
          "Full access to the exhibition floor and after-parties",
        ],
        faqs: [
          { question: "What should I bring?", answer: "A valid ID and your digital ticket QR code (printed or on your phone)." },
          { question: "Is there parking at the venue?", answer: "Yes — the Eko Convention Centre has paid on-site parking and overflow parking 200m away." },
          { question: "Can I transfer my ticket to someone else?", answer: "Yes, up to 48 hours before the event. Contact the organiser with the new attendee's details." },
        ],
        description: "Nigeria's premier entrepreneurship conference bringing together innovators, investors, and industry leaders. Three days of inspiring keynotes, workshops, and networking sessions designed to transform your business vision into reality.",
        category: "conference" as const,
        type: "standard" as const,
        startDate: new Date("2027-03-15T09:00:00"),
        endDate: new Date("2027-03-17T18:00:00"),
        venue: "Eko Convention Centre",
        city: "Lagos",
        capacity: 2000,
        bannerColor: "#7C3AED",
        requiresApproval: true,
        status: "published" as const,
        refundPolicy: "Full refund available up to 7 days before the event.",
        customConfirmationMessage: "Thank you for registering! Please arrive 30 minutes early. Business casual attire. Bring your ID.",
        seatSelectionEnabled: true,
        customQuestions: [
          { id: "q_goal", label: "What do you want to get out of the summit?", type: "text" as const, required: false },
          { id: "q_size", label: "Organisation size", type: "dropdown" as const, required: true, options: ["1–10", "11–50", "51–200", "200+"] },
        ],
      },
      {
        title: "Corporate Leadership Workshop",
        tagline: "One intensive day for executives: modern leadership, team management and digital transformation.",
        imageUrl: "/events/workshop.jpg",
        format: "in_person" as const,
        highlights: [
          "8 hours of facilitated executive training",
          "Leadership diagnostic and personal action plan",
          "Lunch and refreshments included",
          "Certificate of completion",
        ],
        description: "An intensive one-day workshop for senior executives and managers focused on modern leadership techniques, team management, and organisational transformation in the digital age.",
        category: "workshop" as const,
        type: "standard" as const,
        startDate: new Date("2027-02-20T08:00:00"),
        endDate: new Date("2027-02-20T17:00:00"),
        venue: "Transcorp Hilton",
        city: "Abuja",
        capacity: 200,
        bannerColor: "#2563EB",
        requiresApproval: false,
        status: "published" as const,
        refundPolicy: "No refunds within 48 hours of event.",
      },
      {
        title: "Port Harcourt Tech Festival",
        tagline: "Free two-day festival celebrating Niger Delta innovation: demos, hackathons and hiring.",
        imageUrl: "/events/tech-festival.jpg",
        format: "in_person" as const,
        highlights: [
          "Free entry for everyone (registration required)",
          "Live hackathon with ₦2m in prizes",
          "30+ startups on the demo floor",
          "Recruiters hiring on both days",
        ],
        faqs: [
          { question: "Do I need to print my ticket?", answer: "No — your QR code works straight from your phone screen." },
        ],
        description: "A free technology festival celebrating innovation in the Niger Delta. Featuring demo showcases, hackathons, panel discussions, and opportunities to connect with tech companies and startups.",
        category: "networking" as const,
        type: "standard" as const,
        startDate: new Date("2027-04-05T10:00:00"),
        endDate: new Date("2027-04-06T20:00:00"),
        venue: "University of Port Harcourt Auditorium",
        city: "Port Harcourt",
        capacity: 5000,
        bannerColor: "#059669",
        requiresApproval: false,
        status: "published" as const,
        waitlistEnabled: true,
      },
      {
        title: "RCCG Special Convention 2027",
        tagline: "Three days of worship, word and fellowship at Redemption Camp.",
        imageUrl: "/events/convention.jpg",
        format: "in_person" as const,
        highlights: [
          "Free registration for all members and guests",
          "Simultaneous interpretation available",
          "Overnight accommodation blocks on camp",
          "Children's church for ages 3–12",
        ],
        description: "Annual special convention for members and guests. A powerful gathering featuring worship, word, and fellowship. All are welcome.",
        category: "church" as const,
        type: "standard" as const,
        startDate: new Date("2027-05-01T08:00:00"),
        endDate: new Date("2027-05-03T22:00:00"),
        venue: "Redemption Camp",
        city: "Lagos",
        capacity: 50000,
        bannerColor: "#DC2626",
        requiresApproval: false,
        status: "published" as const,
      },
      {
        title: "Professional Photography Masterclass",
        tagline: "A hands-on studio day with award-winning photographers — limited to 30 seats.",
        imageUrl: "/events/masterclass.jpg",
        format: "in_person" as const,
        highlights: [
          "Small group: just 30 participants",
          "Studio lighting, portrait and product practicals",
          "Portfolio review with the instructors",
          "Lunch included",
        ],
        description: "Learn professional photography techniques from award-winning photographers. Covers portrait, product, and event photography. Limited to 30 participants for maximum learning experience.",
        category: "training" as const,
        type: "standard" as const,
        startDate: new Date("2027-02-28T09:00:00"),
        endDate: new Date("2027-02-28T17:00:00"),
        venue: "Studio 24",
        city: "Lagos",
        capacity: 30,
        bannerColor: "#D97706",
        requiresApproval: true,
        status: "published" as const,
        refundPolicy: "Full refund up to 14 days before event.",
      },
      {
        title: "Startup Growth Clinic (Weekly)",
        tagline: "Book a 30-minute growth appointment with a mentor — every Wednesday, for 8 weeks.",
        imageUrl: "/events/startup-clinic.jpg",
        format: "hybrid" as const,
        highlights: [
          "8 weekly mentoring sessions (Wednesdays)",
          "30-minute one-to-one appointments",
          "Growth scorecard and action plan each session",
          "Join online or in person at CcHUB",
        ],
        description: "A recurring weekly clinic where founders book a 30-minute appointment with growth mentors. Bring your numbers — leave with an action plan.",
        category: "seminar" as const,
        type: "recurring" as const,
        startDate: new Date("2027-02-03T09:00:00"),
        endDate: new Date("2027-02-03T17:00:00"),
        venue: "Co-Creation Hub",
        city: "Lagos",
        capacity: 60,
        bannerColor: "#0891B2",
        requiresApproval: false,
        status: "published" as const,
        recurrenceRule: {
          frequency: "weekly" as const,
          interval: 1,
          count: 8,
          weekdays: [3],
          time: "09:00",
          durationMinutes: 480,
        },
      },
      {
        title: "Graduate Careers Appointment Day",
        tagline: "Book a personal 30-minute slot with an advisor or hiring partner.",
        imageUrl: "/events/careers-day.jpg",
        format: "in_person" as const,
        highlights: [
          "Free 30-minute appointments from 9am",
          "CV clinic and mock interviews",
          "Meet recruiters from 15+ employers",
          "Open to all final-year students and graduates",
        ],
        description: "Book a personal 30-minute appointment with a careers advisor or one of our hiring partners. Slots open daily from 9am to 4pm.",
        category: "university" as const,
        type: "timeslot" as const,
        startDate: new Date("2027-03-20T09:00:00"),
        endDate: new Date("2027-03-20T16:00:00"),
        venue: "University of Lagos — Career Centre",
        city: "Lagos",
        capacity: 120,
        bannerColor: "#7C3AED",
        requiresApproval: false,
        status: "published" as const,
      },
    ];

    /*
     * UEB-owned discovery catalogue. This is deliberately local rather than
     * proxying a competitor's marketplace: organisers and attendees stay on
     * UEB, and the same first-party /api/events feed powers Home and Discover.
     * Six entries are created for every category so the category filters are
     * useful even on a fresh installation.
     */
    const catalogue = [
      {
        category: "conference" as const,
        titles: [
          "Lagos Future Cities Conference", "Africa Product Leaders Conference", "West Africa Health Conference",
          "Sustainable Business Conference", "Women in Enterprise Conference", "Creative Economy Conference",
        ],
      },
      {
        category: "seminar" as const,
        titles: [
          "Personal Finance Seminar", "Export Readiness Seminar", "Digital Marketing Seminar",
          "Public Speaking Seminar", "Data Literacy Seminar", "Workplace Wellness Seminar",
        ],
      },
      {
        category: "workshop" as const,
        titles: [
          "No-Code Product Workshop", "Brand Strategy Workshop", "Project Management Workshop",
          "Food Business Workshop", "Frontend Engineering Workshop", "Grant Writing Workshop",
        ],
      },
      {
        category: "concert" as const,
        titles: [
          "Lagos Live Sessions", "Afrobeats Sunset Concert", "Jazz by the Lagoon",
          "Northern Sounds Live", "Indie Night Lagos", "Praise & Culture Concert",
        ],
      },
      {
        category: "corporate" as const,
        titles: [
          "Annual Strategy Offsite", "Customer Experience Forum", "People & Culture Summit",
          "Finance Leaders Roundtable", "Sales Excellence Bootcamp", "Boardroom Breakfast",
        ],
      },
      {
        category: "university" as const,
        titles: [
          "Campus Innovation Fair", "Alumni Homecoming", "Student Research Showcase",
          "University Debate Open", "Freshers Welcome Week", "Interfaculty Games",
        ],
      },
      {
        category: "church" as const,
        titles: [
          "Lagos Worship Night", "Young Adults Retreat", "Women of Purpose Conference",
          "Men of Faith Breakfast", "Family Life Weekend", "Community Outreach Day",
        ],
      },
      {
        category: "government" as const,
        titles: [
          "Public Service Innovation Forum", "Lagos SME Policy Dialogue", "Open Data Stakeholder Forum",
          "Climate Resilience Roundtable", "Citizen Engagement Town Hall", "Local Government Leadership Forum",
        ],
      },
      {
        category: "wedding" as const,
        titles: [
          "Ada & Tobi Wedding Celebration", "Chinwe & Kelechi Traditional Wedding", "Maya & Femi White Wedding",
          "Sade & Dapo Engagement Party", "Amaka & Chinedu Garden Wedding", "Zainab & Ibrahim Nikah",
        ],
      },
      {
        category: "networking" as const,
        titles: [
          "Founders & Funders Mixer", "Lagos Product People Meetup", "Women Build Africa Mixer",
          "Creative Professionals Social", "Diaspora Connect Nigeria", "Real Estate Leaders Mixer",
        ],
      },
      {
        category: "training" as const,
        titles: [
          "Excel for Business Training", "Leadership Essentials Training", "Cybersecurity Awareness Training",
          "Customer Service Training", "Financial Modelling Training", "First Aid at Work Training",
        ],
      },
      {
        category: "exhibition" as const,
        titles: [
          "Lagos Art & Design Exhibition", "Made in Nigeria Trade Fair", "Photography Open Showcase",
          "Future Mobility Exhibition", "Food & Culture Market", "African Design Week",
        ],
      },
      {
        category: "fundraising" as const,
        titles: [
          "Run for Education", "Community Health Benefit", "Children's Scholarship Dinner",
          "Creative Arts Fundraiser", "Food Bank Giving Day", "Climate Action Fundraiser",
        ],
      },
      {
        category: "private" as const,
        titles: [
          "Executive Dinner Series", "Invite-Only Founder Circle", "Private Film Screening",
          "Family Heritage Celebration", "Collectors Preview Night", "Members Garden Party",
        ],
      },
      {
        category: "other" as const,
        titles: [
          "Lagos Community Day", "Saturday Makers Market", "New Beginnings Meetup",
          "The Local Experience", "Ideas Worth Sharing", "Open Mic & Stories",
        ],
      },
    ] as const;

    const catalogueImages = [
      "/events/summit.jpg", "/events/workshop.jpg", "/events/tech-festival.jpg",
      "/events/convention.jpg", "/events/masterclass.jpg", "/events/startup-clinic.jpg",
    ];
    const catalogueCities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"];
    const catalogueColors = ["#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#0891B2"];
    const catalogueEvents = catalogue.flatMap((group, groupIndex) => group.titles.map((title, index) => {
      const online = index === 4;
      const hybrid = index === 5;
      const city = online ? "Online" : catalogueCities[(groupIndex + index) % catalogueCities.length];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14 + groupIndex * 3 + index * 4);
      startDate.setHours(9 + (index % 5), 0, 0, 0);
      const type = group.category === "training" && index === 5 ? "timeslot" as const : "standard" as const;
      return {
        title,
        tagline: `${group.category[0].toUpperCase()}${group.category.slice(1)} experiences curated for Nigeria's next generation of organisers and communities.`,
        description: `Join this UEB ${group.category} event for practical sessions, trusted connections and an experience designed around the people in the room.`,
        category: group.category,
        type,
        format: online ? "online" as const : hybrid ? "hybrid" as const : "in_person" as const,
        startDate,
        endDate: new Date(startDate.getTime() + (index % 2 === 0 ? 8 : 4) * 60 * 60 * 1000),
        venue: online ? "UEB Live" : `${city} Event Centre`,
        city,
        capacity: 120 + (index * 80) + (groupIndex * 20),
        imageUrl: catalogueImages[(groupIndex + index) % catalogueImages.length],
        gallery: [catalogueImages[(groupIndex + index) % catalogueImages.length]],
        bannerColor: catalogueColors[(groupIndex + index) % catalogueColors.length],
        highlights: [
          "Branded registration and digital ticketing on UEB",
          "Connect with attendees, speakers and partners",
          "QR check-in and live attendance tracking",
        ],
        faqs: [],
        requiresApproval: group.category === "private" || index === 2,
        status: "published" as const,
        listed: true,
      };
    }));
    const allDemoEvents = [...demoEvents, ...catalogueEvents];
    const originalDemoEventCount = demoEvents.length;

    const ticketData = [
      [
        { name: "Early Bird", type: "early_bird" as const, price: "15000", quantity: 500 },
        { name: "Regular", type: "paid" as const, price: "25000", quantity: 1000 },
        { name: "VIP", type: "vip" as const, price: "75000", quantity: 200 },
        { name: "Corporate Table (10)", type: "group" as const, price: "200000", quantity: 30, groupSize: 10 },
      ],
      [
        { name: "Standard", type: "paid" as const, price: "35000", quantity: 150 },
        { name: "Executive", type: "vip" as const, price: "75000", quantity: 50 },
      ],
      [
        { name: "Free Entry", type: "free" as const, price: "0" },
        { name: "VIP Access", type: "vip" as const, price: "5000", quantity: 500 },
      ],
      [
        { name: "Free Registration", type: "free" as const, price: "0" },
      ],
      [
        { name: "Masterclass Seat", type: "paid" as const, price: "45000", quantity: 30 },
      ],
      [
        { name: "Clinic Seat", type: "free" as const, price: "0" },
        { name: "Founder Pass (4 sessions)", type: "group" as const, price: "15000", quantity: 60, groupSize: 4 },
      ],
      [
        { name: "Advisor Appointment", type: "free" as const, price: "0" },
      ],
    ];

    const sampleNames = ["Emeka Obi", "Fatima Hassan", "Chukwuemeka Eze", "Aisha Mohammed", "Tunde Adeyemi", "Ngozi Okafor", "Babatunde Lawal", "Amina Yusuf", "Ikenna Nwankwo", "Kemi Adeleke", "Obinna Okonkwo", "Halima Bello"];

    let backfilled = 0;
    let created = 0;

    for (let i = 0; i < allDemoEvents.length; i++) {
      const eventData = allDemoEvents[i];
      const slug = slugify(eventData.title) + "-" + nanoid(6);

      const org = orgs[i % 3 === 2 ? 2 : i % 3];

      /* ── Idempotency: if this demo event already exists, only backfill the
         Eventbrite-style display fields (cover, tagline, org link, gallery…)
         and leave its tiers / registrations / seats untouched. ── */
      const existingEvent = await db
        .select({ id: events.id, organisationId: events.organisationId })
        .from(events)
        .where(eq(events.title, eventData.title))
        .limit(1);

      if (existingEvent.length > 0) {
        const ex = existingEvent[0];
        await db.update(events).set({
          tagline: eventData.tagline,
          imageUrl: eventData.imageUrl,
          gallery: eventData.gallery,
          format: eventData.format,
          highlights: eventData.highlights,
          faqs: eventData.faqs,
          organisationId: org.id,
        }).where(eq(events.id, ex.id));

        if (!ex.organisationId) {
          await db.update(organisations)
            .set({ eventsHosted: (org.eventsHosted ?? 0) + 1 })
            .where(eq(organisations.id, org.id));
          org.eventsHosted = (org.eventsHosted ?? 0) + 1;
        }
        backfilled++;
        continue;
      }

      created++;
      const [event] = await db.insert(events).values({
        ...eventData,
        slug,
        organiserId: adminUser.id,
        organisationId: org.id,
        totalRegistrations: 0,
        totalCheckins: 0,
        totalRevenue: "0",
      }).returning();

      const tiers = ticketData[i] ?? [
        {
          name: eventData.requiresApproval ? "Application Pass" : "General Admission",
          type: eventData.requiresApproval ? "invitation_only" as const : "paid" as const,
          price: eventData.requiresApproval ? "0" : String(5000 + ((i - originalDemoEventCount) % 6) * 2500),
          quantity: eventData.capacity ?? 250,
        },
      ];
      const insertedTiers = [];
      for (const tier of tiers) {
        const [t] = await db.insert(ticketTiers).values({ eventId: event.id, ...tier, price: tier.price.toString() }).returning();
        insertedTiers.push(t);
      }

      /* ── Recurring series → dated occurrences ── */
      if (eventData.type === "recurring" && "recurrenceRule" in eventData && eventData.recurrenceRule) {
        const rule = eventData.recurrenceRule as RecurrenceRule;
        const dates = expandRecurrence(new Date(eventData.startDate), rule, 60);
        if (dates.length) {
          await db.insert(eventOccurrences).values(
            dates.map((d, idx) => ({
              eventId: event.id,
              label: `Clinic ${idx + 1}`,
              startDate: d.start,
              endDate: d.end,
              capacity: event.capacity ?? null,
              status: "scheduled",
            }))
          );
        }
      }

      /* ── Appointment slots ── */
      if (eventData.type === "timeslot") {
        const generated = expandSlots(new Date(eventData.startDate), {
          startTime: "09:00",
          endTime: "16:00",
          durationMinutes: 30,
        });
        if (generated.length) {
          await db.insert(eventSlots).values(
            generated.map((s) => ({
              eventId: event.id,
              label: `${s.start.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} – ${s.end.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`,
              startDate: s.start,
              endDate: s.end,
              capacity: 1,
            }))
          );
        }
      }

      /* ── Sample registrations ── */
      // Keep the curated catalogue lightweight; the seven showcase events
      // retain the richer sample registrations used by the organiser screens.
      const numRegs = i < originalDemoEventCount ? Math.floor(Math.random() * 8) + 3 : 0;
      const statuses: ("pending" | "approved" | "rejected" | "on_hold")[] = ["approved", "approved", "approved", "pending", "approved", "rejected", "approved", "approved", "on_hold", "approved"];
      let totalRev = 0;
      const createdRegs: (typeof registrations.$inferSelect)[] = [];

      // Grab any slots for this event so a few registrations can be booked into them
      const eventSlotRows = eventData.type === "timeslot"
        ? await db.select().from(eventSlots).where(eq(eventSlots.eventId, event.id))
        : [];

      for (let j = 0; j < numRegs; j++) {
        const name = sampleNames[j % sampleNames.length];
        const email = `${name.toLowerCase().replace(/\s/g, ".")}${j}@email.com`;
        const tier = insertedTiers[j % insertedTiers.length];
        const price = parseFloat(tier.price ?? "0");
        const status = statuses[j % statuses.length];
        const paid = price === 0 || status === "approved";
        const checkedIn = status === "approved" && j % 3 === 0;

        const ticketNumber = paid ? generateTicketNumber() : null;
        const qrCode = ticketNumber
          ? await QRCode.toDataURL(JSON.stringify({ ticketNumber, eventId: event.id, attendeeEmail: email }), { width: 240, margin: 1 })
          : null;
        const slot = eventSlotRows.length ? eventSlotRows[j % eventSlotRows.length] : null;

        const [reg] = await db.insert(registrations).values({
          eventId: event.id,
          ticketTierId: tier.id,
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: `080${Math.floor(10000000 + Math.random() * 89999999)}`,
          organisation: ["Lagos University", "Shell Nigeria", "Dangote Group", "MTN Nigeria", "First Bank"][j % 5],
          jobTitle: ["Manager", "Director", "CEO", "Student", "Engineer", "Analyst"][j % 6],
          status,
          paymentStatus: paid ? "paid" : "pending",
          amountPaid: paid && price > 0 ? price.toString() : "0",
          ticketNumber,
          qrCode,
          ticketIssuedAt: ticketNumber ? new Date() : null,
          checkedIn,
          checkedInAt: checkedIn ? new Date() : null,
          checkedInBy: checkedIn ? "Check-in desk" : null,
          slotId: slot?.id ?? null,
          slotLabel: slot?.label ?? null,
          customAnswers: j % 2 === 0 ? { q_goal: "Investor introductions", q_size: ["1–10", "11–50", "51–200", "200+"][j % 4] } : {},
        }).returning();

        createdRegs.push(reg);

        if (paid && price > 0) {
          totalRev += price;
          await db.insert(payments).values({
            eventId: event.id,
            registrationId: reg.id,
            provider: "paystack",
            channel: ["card", "bank_transfer", "ussd"][j % 3],
            reference: generatePaymentReference("UEB"),
            amount: price.toString(),
            feeAmount: (Math.round(price * 0.08) + 100).toString(),
            netAmount: price.toString(),
            status: "successful",
            payerEmail: email,
            paidAt: new Date(),
            meta: { tierName: tier.name, seeded: true },
          });
          await db.update(registrations).set({ paymentReference: reg.paymentReference }).where(eq(registrations.id, reg.id));
        }

        if (slot && paid) {
          await db.update(eventSlots).set({ booked: (slot.booked ?? 0) + 1 }).where(eq(eventSlots.id, slot.id));
        }

        if (checkedIn) {
          await db.insert(checkinLogs).values({
            eventId: event.id,
            registrationId: reg.id,
            ticketNumber,
            result: "VALID",
            method: j % 2 === 0 ? "scan" : "manual",
            staffName: "Desk Staff",
            scannedAt: new Date(),
          });
        }
      }

      /* ── Seating plan + seat assignments ── */
      if (event.seatSelectionEnabled) {
        const sections = [
          { name: "VIP Front", rows: 3, seatsPerRow: 8, tierName: "VIP" },
          { name: "Main Floor", rows: 8, seatsPerRow: 15, tierName: "Regular" },
        ];
        for (const sec of sections) {
          const [section] = await db.insert(seatingSections).values({
            eventId: event.id, name: sec.name, rows: sec.rows, seatsPerRow: sec.seatsPerRow, tierName: sec.tierName,
          }).returning();
          await db.insert(seats).values(
            seatLabels(sec.rows, sec.seatsPerRow, sec.name).map((s) => ({
              eventId: event.id, sectionId: section.id, label: s.label, rowName: s.rowName, seatNumber: s.seatNumber, status: "available",
            }))
          );
        }
        // Seat the approved attendees
        const allSeats = await db.select().from(seats).where(eq(seats.eventId, event.id));
        let seatIdx = 0;
        for (const reg of createdRegs.filter((r) => r.status === "approved")) {
          const seat = allSeats[seatIdx++];
          if (!seat) break;
          await db.update(seats).set({ status: "assigned", registrationId: reg.id }).where(eq(seats.id, seat.id));
          await db.update(registrations).set({ seatId: seat.id, seatLabel: seat.label }).where(eq(registrations.id, reg.id));
        }
      }

      /* ── Vendors ── */
      if (i < originalDemoEventCount && i % 2 === 0) {
        await db.insert(vendors).values(
          [
            { name: "Mama's Kitchen", category: "Food & Beverage", contactName: "Ngozi Eze", email: "ngozzi@mamaskitchen.ng", stallNumber: "A1", fee: "150000", amountPaid: "150000", status: "confirmed" },
            { name: "Lagos Print Hub", category: "Merchandise", contactName: "Segun Ade", email: "hello@lagosprint.ng", stallNumber: "A2", fee: "90000", amountPaid: "45000", status: "confirmed" },
            { name: "Sonar AV", category: "AV & Production", contactName: "Ifeoma Nnaji", email: "book@sonarav.com", stallNumber: "B1", fee: "350000", amountPaid: "0", status: "invited" },
          ].map((v) => ({ ...v, eventId: event.id, notes: null }))
        );
      }

      /* ── Communications history ── */
      if (numRegs > 0) {
        await db.insert(eventMessages).values([
          {
            eventId: event.id,
            channel: "email",
            audience: "approved",
            subject: `Your ticket for ${event.title}`,
            body: "Your registration has been approved. Open your digital ticket and save the QR code to your phone.",
            recipientCount: createdRegs.filter((r) => r.status === "approved" && r.ticketNumber).length,
            status: "sent",
            senderName: "UEB Organiser",
            sentAt: new Date(Date.now() - 36 * 3600 * 1000),
          },
          {
            eventId: event.id,
            channel: "whatsapp",
            audience: "pending",
            subject: "Reminder",
            body: "You are on the list but not yet approved — reply here if you need help completing registration.",
            recipientCount: createdRegs.filter((r) => r.status === "pending").length,
            status: "sent",
            senderName: "UEB Organiser",
            sentAt: new Date(Date.now() - 12 * 3600 * 1000),
          },
        ]);
      }

      /* ── Feedback ── */
      if (i < 2) {
        await db.insert(eventFeedback).values([
          { eventId: event.id, attendeeName: "Emeka Obi", rating: 5, comment: "Exceptional organisation — check-in took seconds." },
          { eventId: event.id, attendeeName: "Aisha Mohammed", rating: 4, comment: "Great sessions, more breaks would help." },
          { eventId: event.id, attendeeName: "Tunde Adeyemi", rating: 5, comment: "The seating plan made finding my seat effortless." },
        ]);
      }

      await db.update(events).set({
        totalRegistrations: numRegs,
        totalCheckins: Math.floor(numRegs * 0.3),
        totalRevenue: totalRev.toString(),
      }).where(eq(events.id, event.id));

      await db.update(organisations)
        .set({ eventsHosted: (org.eventsHosted ?? 0) + 1 })
        .where(eq(organisations.id, org.id));
    }

    return NextResponse.json({ success: true, message: "Demo data seeded successfully!", created, backfilled });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Seed failed: " + String(error) }, { status: 500 });
  }
}
