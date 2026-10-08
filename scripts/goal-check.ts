import assert from "node:assert"
import { goalFor, goalStatus } from "../src/lib/goals"

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const club = { goalPercent: 50, goalDate: d("2026-11-01") }
const p = { progressPercent: 10, startDate: d("2026-10-01"), createdAt: d("2026-10-01"), status: "IN_PROGRESS", goalPercent: null, goalDate: null }
// Club goal applies; halfway through (expected ~25%) at 10% is 15 pts behind → flagged.
const s = goalStatus(p, goalFor(p, club), d("2026-10-16"))!
assert.equal(s.source, "club"); assert.ok(s.behind && !s.missed && s.expected > 20)
// Within tolerance → fine.
assert.equal(goalStatus({ ...p, progressPercent: 20 }, goalFor(p, club), d("2026-10-16"))!.behind, false)
// Project goal overrides club; past the date and short → missed.
const own = { ...p, goalPercent: 100, goalDate: d("2026-10-10") }
const m = goalStatus(own, goalFor(own, club), d("2026-10-20"))!
assert.ok(m.source === "project" && m.missed && m.behind)
// Completed projects and no goal → no status.
assert.equal(goalStatus({ ...p, status: "COMPLETED" }, goalFor(p, club)), null)
assert.equal(goalStatus(p, goalFor(p, null)), null)
console.log("✓ goal checks passed")
