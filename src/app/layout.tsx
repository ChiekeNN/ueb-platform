import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UEB — Unique Events Booking", template: "%s · UEB" },
  description: "Africa's Event Operating System. Create, manage, sell, verify and analyse events — all in one elegant platform.",
  keywords: ["events", "ticketing", "Nigeria", "Africa", "conference", "registration", "QR code"],
  authors: [{ name: "Unique Events Booking" }],
  applicationName: "UEB",
  // Manifest from `src/app/manifest.ts`; linked explicitly so installability
  // never depends on the file convention alone.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Installed on iOS: run full-screen and use the abbreviated title.
  appleWebApp: { capable: true, title: "UEB", statusBarStyle: "default" },
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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Site-wide "Install UEB" offer — shows 5s after open, 10s on screen. */}
        <InstallAppPrompt />
      </body>
    </html>
  );
}
