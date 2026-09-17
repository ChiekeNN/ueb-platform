import type { NextConfig } from "next";

/**
 * Dev-server origin allowlist.
 *
 * Next.js blocks cross-origin requests for its dev resources (HMR socket, dev
 * overlays, `/_next/*` internals) unless the requesting host is listed here.
 * The live preview is served from the sandbox proxy, and local checks use
 * 127.0.0.1 — both must be allowed or client-side hydration stalls and pages
 * stay on their loading skeletons.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.e2b.app",
    "*.e2b.dev",
    "*.arena.ai",
    "*.vercel.app",
  ],
};

export default nextConfig;
