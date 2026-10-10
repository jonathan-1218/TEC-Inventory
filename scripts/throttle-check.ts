// Run against a throwaway DB: DATABASE_URL=… npx tsx scripts/throttle-check.ts
import assert from "node:assert"
import { allow, clearLimit } from "../src/lib/throttle"
import { db } from "../src/lib/db"

async function main() {
  const key = `check:${process.pid}`
  const results = await Promise.all(Array.from({ length: 8 }, () => allow(key, 5, 60_000)))
  assert.equal(results.filter(Boolean).length, 5, "exactly 5 of 8 concurrent attempts pass") // atomic under concurrency
  assert.equal(await allow(`${key}:short`, 1, 1), true)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(await allow(`${key}:short`, 1, 1), true, "window resets") // expired window starts over
  await clearLimit(key)
  assert.equal(await allow(key, 5, 60_000), true, "clear resets")
  await db.rateLimit.deleteMany({ where: { key: { startsWith: key } } })
  console.log("✓ throttle checks passed")
}
main().finally(() => db.$disconnect())
