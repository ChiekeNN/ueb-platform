import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, ticketTiers, registrations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTicketNumber, slugify } from "@/lib/utils";
import { nanoid } from "nanoid";
import QRCode from "qrcode";

export async function POST(_req: NextRequest) {
  try {
    // Create demo users
    const existingUsers = await db.select().from(users).where(eq(users.email, "admin@ueb.ng")).limit(1);
    let adminUser;
    if (existingUsers.length === 0) {
      [adminUser] = await db.insert(users).values([
        { name: "UEB Admin", email: "admin@ueb.ng", role: "platform_admin", organisation: "Unique Events Booking" },
        { name: "Chidi Okonkwo", email: "chidi@upec.edu.ng", role: "event_owner", organisation: "UPEC University" },
        { name: "Amara Nwosu", email: "amara@abccorp.ng", role: "event_owner", organisation: "ABC Corporation" },
      ]).returning();
    } else {
      adminUser = existingUsers[0];
    }

    const demoEvents = [
      {
        title: "Annual Entrepreneurship Summit 2027",
        description: "Nigeria's premier entrepreneurship conference bringing together innovators, investors, and industry leaders. Three days of inspiring keynotes, workshops, and networking sessions designed to transform your business vision into reality.",
        category: "conference" as const,
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
      },
      {
        title: "Corporate Leadership Workshop",
        description: "An intensive one-day workshop for senior executives and managers focused on modern leadership techniques, team management, and organisational transformation in the digital age.",
        category: "workshop" as const,
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
        description: "A free technology festival celebrating innovation in the Niger Delta. Featuring demo showcases, hackathons, panel discussions, and opportunities to connect with tech companies and startups.",
        category: "networking" as const,
        startDate: new Date("2027-04-05T10:00:00"),
        endDate: new Date("2027-04-06T20:00:00"),
        venue: "University of Port Harcourt Auditorium",
        city: "Port Harcourt",
        capacity: 5000,
        bannerColor: "#059669",
        requiresApproval: false,
        status: "published" as const,
      },
      {
        title: "RCCG Special Convention 2027",
        description: "Annual special convention for members and guests. A powerful gathering featuring worship, word, and fellowship. All are welcome.",
        category: "church" as const,
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
        description: "Learn professional photography techniques from award-winning photographers. Covers portrait, product, and event photography. Limited to 30 participants for maximum learning experience.",
        category: "training" as const,
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
    ];

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
    ];

    const sampleNames = ["Emeka Obi", "Fatima Hassan", "Chukwuemeka Eze", "Aisha Mohammed", "Tunde Adeyemi", "Ngozi Okafor", "Babatunde Lawal", "Amina Yusuf", "Ikenna Nwankwo", "Kemi Adeleke", "Obinna Okonkwo", "Halima Bello"];

    for (let i = 0; i < demoEvents.length; i++) {
      const eventData = demoEvents[i];
      const slug = slugify(eventData.title) + "-" + nanoid(6);

      const [event] = await db.insert(events).values({
        ...eventData,
        slug,
        organiserId: adminUser.id,
        totalRegistrations: 0,
        totalCheckins: 0,
        totalRevenue: "0",
      }).returning();

      const tiers = ticketData[i];
      const insertedTiers = [];
      for (const tier of tiers) {
        const [t] = await db.insert(ticketTiers).values({ eventId: event.id, ...tier, price: tier.price.toString() }).returning();
        insertedTiers.push(t);
      }

      // Add sample registrations
      const numRegs = Math.floor(Math.random() * 8) + 3;
      const statuses: ("pending" | "approved" | "rejected" | "on_hold")[] = ["approved", "approved", "approved", "pending", "approved", "rejected", "approved", "approved", "on_hold", "approved"];
      let totalRev = 0;

      for (let j = 0; j < numRegs; j++) {
        const name = sampleNames[j % sampleNames.length];
        const email = `${name.toLowerCase().replace(/\s/g, ".")}${j}@email.com`;
        const tier = insertedTiers[0];
        const price = parseFloat(tier.price ?? "0");
        const ticketNumber = generateTicketNumber();
        const status = statuses[j % statuses.length];
        const qrData = JSON.stringify({ ticketNumber, eventId: event.id, attendeeEmail: email });
        const qrCode = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
        const checkedIn = status === "approved" && j % 3 === 0;

        await db.insert(registrations).values({
          eventId: event.id,
          ticketTierId: tier.id,
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: `080${Math.floor(10000000 + Math.random() * 89999999)}`,
          organisation: ["Lagos University", "Shell Nigeria", "Dangote Group", "MTN Nigeria", "First Bank"][j % 5],
          jobTitle: ["Manager", "Director", "CEO", "Student", "Engineer", "Analyst"][j % 6],
          status,
          paymentStatus: price > 0 && status === "approved" ? "paid" : (price === 0 ? "paid" : "pending"),
          amountPaid: status === "approved" && price > 0 ? price.toString() : "0",
          ticketNumber,
          qrCode,
          checkedIn,
          checkedInAt: checkedIn ? new Date() : null,
          customAnswers: {},
        });

        if (status === "approved" && price > 0) totalRev += price;
      }

      await db.update(events).set({
        totalRegistrations: numRegs,
        totalCheckins: Math.floor(numRegs * 0.3),
        totalRevenue: totalRev.toString(),
      }).where(eq(events.id, event.id));
    }

    return NextResponse.json({ success: true, message: "Demo data seeded successfully!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Seed failed: " + String(error) }, { status: 500 });
  }
}
