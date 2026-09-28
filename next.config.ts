import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile in a parent folder isn't picked up.
  turbopack: { root: __dirname },
  // The /chart-kit showcase is dev-only. Its page-level notFound() streams as a soft 404 (HTTP 200) under
  // app/loading.tsx, so send it to an unmatched path in production for a real 404.
  async rewrites() {
    return process.env.NODE_ENV === "production" ? { beforeFiles: [{ source: "/chart-kit", destination: "/_dev-only" }] } : []
  },
}

export default nextConfig
