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

// The inventory app is served from its own subdomain; the club homepage stays on the apex domain. Both are this one
// deployment, told apart by the Host header. On any other host (localhost, Vercel previews) none of these rules
// match and everything is reachable by path, as before.
const SITE_HOST = "(?:www\\.)?theelectronicsclub\\.in"
const APP_HOST = "dashboard.theelectronicsclub.in"
const APP_ORIGIN = `https://${APP_HOST}`
// Every top-level route of the app and the team portal ("/dashboard" is separate: on the subdomain it is "/").
const APP_ROUTES = ["accounts", "admin", "inventory", "issuances", "members", "projects", "search", "tasks", "teams", "team", "login", "signup", "my"]
const onSite = [{ type: "host" as const, value: SITE_HOST }]
const onApp = [{ type: "host" as const, value: APP_HOST.replaceAll(".", "\\.") }]

const nextConfig: NextConfig = {
  // Hides the round "N" dev-tools badge that floats bottom-left in `next dev` (it never exists in production).
  devIndicators: false,
  // Pin the project root so a stray lockfile in a parent folder isn't picked up.
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },
  // Project teams have their own portal under /team; keep the old addresses working.
  async redirects() {
    return [
      // Apex domain: app addresses move to the subdomain (login cookies are per-host, so the app must live on one).
      { source: "/dashboard", has: onSite, destination: APP_ORIGIN, permanent: false },
      ...APP_ROUTES.map((r) => ({ source: `/${r}/:path*`, has: onSite, destination: `${APP_ORIGIN}/${r}/:path*`, permanent: false })),
      // Subdomain: the dashboard is served at "/" (rewrite below), so its own path folds back onto it.
      { source: "/dashboard", has: onApp, destination: "/", permanent: false },
      { source: "/login", destination: "/team/login", permanent: false },
      { source: "/signup", destination: "/team/signup", permanent: false },
      { source: "/my", destination: "/team", permanent: false },
    ]
  },
  // The /chart-kit showcase is dev-only. Its page-level notFound() streams as a soft 404 (HTTP 200) under
  // app/loading.tsx, so send it to an unmatched path in production for a real 404.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: onApp, destination: "/dashboard" },
        ...(process.env.NODE_ENV === "production" ? [{ source: "/chart-kit", destination: "/_dev-only" }] : []),
      ],
    }
  },
}

export default nextConfig
