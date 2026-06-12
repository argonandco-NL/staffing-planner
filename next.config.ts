import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Deny framing to block clickjacking (also covered by frame-ancestors in CSP).
  { key: "X-Frame-Options", value: "DENY" },
  // Only send origin on cross-origin requests; no full referrer URL.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not used by this app.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Tell browsers to only connect over HTTPS for the next year.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Restrict resource origins. script-src needs 'unsafe-inline' because Next.js
  // injects inline hydration scripts; tighten to nonces if/when that is set up.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      // Supabase API + realtime WebSockets (wss:// must be listed separately from https://).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // next/font/google self-hosts fonts at build time under /_next/static/.
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't traverse
  // stray lockfiles in parent directories (which can blow up memory).
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
