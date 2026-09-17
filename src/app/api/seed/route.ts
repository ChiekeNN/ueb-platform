import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  ticketTiers,
  registrations,
  users,
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
      const numRegs = Math.floor(Math.random() * 8) + 3;
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
      if (i % 2 === 0) {
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
    }

    return NextResponse.json({ success: true, message: "Demo data seeded successfully!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Seed failed: " + String(error) }, { status: 500 });
  }
}
