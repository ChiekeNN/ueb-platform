import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UEB — Unique Events Booking", template: "%s · UEB" },
  description: "Africa's Event Operating System. Create, manage, sell, verify and analyse events — all in one elegant platform.",
  keywords: ["events", "ticketing", "Nigeria", "Africa", "conference", "registration", "QR code"],
  authors: [{ name: "Unique Events Booking" }],
  openGraph: {
    title: "UEB — Unique Events Booking",
    description: "Africa's Event Operating System",
    type: "website",
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image", title: "UEB — Unique Events Booking" },
};

export const viewport: Viewport = {
  themeColor: "#6D28D9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The product uses one shared font link from the root layout. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
