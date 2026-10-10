import { headers } from "next/headers"
import { db } from "@/lib/db"

/**
 * Counts one attempt against `key` in a fixed window, in Postgres so every serverless instance shares it.
 * Returns false once more than `max` attempts landed in the current window.
 */
export async function allow(key: string, max: number, windowMs: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowMs / 1000}) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowMs / 1000}) THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`
  return rows[0].count <= max
}

/** Every limit must pass (all are counted, so one key can't be probed without spending the others). */
export async function allowAll(limits: [key: string, max: number, windowMs: number][]): Promise<boolean> {
  const results = await Promise.all(limits.map((l) => allow(...l)))
  return results.every(Boolean)
}

export async function clearLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } })
}

/** Caller IP. On Vercel `x-vercel-forwarded-for` / `x-real-ip` are set by the edge, not the client. */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
}

export const MINUTE = 60_000
