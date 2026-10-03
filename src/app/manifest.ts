import type { MetadataRoute } from "next";

/**
 * Web app manifest — the file that makes UEB installable.
 *
 * Next serves this at `/manifest.webmanifest` and links it from every page.
 * For the browser to offer installation ("Install app" / "Add to Home Screen")
 * all of the following must line up:
 *
 *   • `name` + `short_name`            — the label under the home-screen icon
 *   • `start_url` + `scope`            — where the installed app opens
 *   • `display: standalone`            — no browser chrome once installed
 *   • 192px and 512px PNG icons        — Chrome/Edge refuse without both
 *   • a service worker with a fetch handler (`/sw.js`, registered by
 *     `<InstallAppPrompt />`) — without it Chrome will not fire
 *     `beforeinstallprompt`, so no install UI can ever appear
 *
 * `id` pins the app identity: changing `start_url` later still counts as the
 * same installed app instead of creating a duplicate.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UEB — Unique Events Booking",
    short_name: "UEB",
    description:
      "Africa's Event Operating System. Create, manage, sell, verify and analyse events — all in one place.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#F7F7FB",
    theme_color: "#6D28D9",
    lang: "en-NG",
    dir: "ltr",
    categories: ["events", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Discover events",
        short_name: "Discover",
        url: "/events",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Create an event",
        short_name: "Create",
        url: "/events/create",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Check-in desk",
        short_name: "Check-in",
        url: "/checkin",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
