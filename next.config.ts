import type { NextConfig } from "next"

// Defense-in-depth response headers on every route. frame-ancestors 'none' stops clickjacking of the
// state-changing admin pages; the rest are cheap hardening. A full script/style CSP is intentionally
// omitted for now — it needs per-request nonces to coexist with Next's inline runtime and would risk
// breaking the app; the frame-ancestors CSP below is the safe subset. (ponytail: revisit if we add a nonce.)
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
]

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile in a parent folder isn't picked up.
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },
  // Project teams have their own portal under /team; keep the old addresses working.
  async redirects() {
    return [
      { source: "/login", destination: "/team/login", permanent: false },
      { source: "/signup", destination: "/team/signup", permanent: false },
      { source: "/my", destination: "/team", permanent: false },
    ]
  },
  // The /chart-kit showcase is dev-only. Its page-level notFound() streams as a soft 404 (HTTP 200) under
  // app/loading.tsx, so send it to an unmatched path in production for a real 404.
  async rewrites() {
    return process.env.NODE_ENV === "production" ? { beforeFiles: [{ source: "/chart-kit", destination: "/_dev-only" }] } : []
  },
}

export default nextConfig
