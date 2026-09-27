/**
 * Self-check for the issue/return stock logic and input validation. Runs in a throwaway
 * Postgres schema inside the configured database (DIRECT_URL) and drops it afterwards.
 *   npm run check
 */
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { issue, issuedCount, returnUnits } from "@/lib/stock"
import { ActionError } from "@/lib/action-error"
import { parseDateInput } from "@/lib/dates"
import { issueSchema, projectCreateSchema } from "@/lib/validators"

if (existsSync(".env")) process.loadEnvFile(".env")
const base = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!base) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env")
const schema = `tec_check_${process.pid}`
const u = new URL(base)
u.searchParams.set("schema", schema)
const url = u.toString()
execSync("npx prisma db push --skip-generate", {
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  stdio: "ignore",
})
const db = new PrismaClient({ datasourceUrl: url })

const run = <T>(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) =>
  db.$transaction(fn, { isolationLevel: "Serializable" })

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (e: unknown) => e instanceof ActionError && pattern.test(e.message))
}

async function main() {
  const comp = await db.component.create({
    data: { name: "Servo", category: "ACTUATOR_MOTOR", quantityTotal: 10, quantityWorking: 8, quantityDamaged: 1, quantityUnderRepair: 1 },
  })
  const member = await db.member.create({
    data: { name: "A", rollNumber: "R1", department: "CSE", yearOfStudy: 2, email: "a@x.edu" },
  })
  const inactive = await db.member.create({
    data: { name: "B", rollNumber: "R2", department: "CSE", yearOfStudy: 2, email: "b@x.edu", isActive: false },
  })
  const project = await db.project.create({ data: { title: "P", techStack: {} } })
  const base = { componentId: comp.id, issuedToMemberId: member.id, issuedDate: parseDateInput("2026-01-10"), expectedReturnDate: null, notes: null }
  const stock = () => db.component.findUniqueOrThrow({ where: { id: comp.id } })
  const pc = () => db.projectComponent.findUnique({ where: { projectId_componentId: { projectId: project.id, componentId: comp.id } } })

  // Issue within availability; project requirement auto-created and tracked.
  const a = await run((tx) => issue(tx, { ...base, quantity: 5, projectId: project.id }))
  assert.equal(await issuedCount(db, comp.id), 5)
  assert.deepEqual([(await pc())?.quantityRequired, (await pc())?.quantityIssued], [5, 5])

  // Can't exceed available (8 working - 5 issued = 3); inactive members blocked.
  await rejects(run((tx) => issue(tx, { ...base, quantity: 4, projectId: null })), /Only 3/)
  await rejects(run((tx) => issue(tx, { ...base, quantity: 1, projectId: null, issuedToMemberId: inactive.id })), /inactive/)

  // Partial return (2 working): open record keeps 3, closed record created.
  const r1 = await run((tx) => returnUnits(tx, { id: a.id, quantity: 2, condition: "WORKING", returnedDate: parseDateInput("2026-01-20"), notes: null }))
  assert.notEqual(r1.id, a.id)
  assert.equal((await db.issuance.findUniqueOrThrow({ where: { id: a.id } })).quantity, 3)
  assert.equal(await issuedCount(db, comp.id), 3)
  assert.equal((await pc())?.quantityIssued, 3)
  let s = await stock()
  assert.deepEqual([s.quantityTotal, s.quantityWorking, s.quantityDamaged], [10, 8, 1])

  // Damaged return moves working -> damaged.
  await run((tx) => returnUnits(tx, { id: a.id, quantity: 1, condition: "DAMAGED", returnedDate: parseDateInput("2026-01-21"), notes: "bent" }))
  s = await stock()
  assert.deepEqual([s.quantityTotal, s.quantityWorking, s.quantityDamaged], [10, 7, 2])

  // Lost return removes from total; full return closes the original record.
  await run((tx) => returnUnits(tx, { id: a.id, quantity: 2, condition: "LOST", returnedDate: parseDateInput("2026-01-22"), notes: null }))
  s = await stock()
  assert.deepEqual([s.quantityTotal, s.quantityWorking, s.quantityDamaged], [8, 5, 2])
  assert.equal(s.quantityWorking + s.quantityDamaged + s.quantityUnderRepair, s.quantityTotal)
  assert.equal(await issuedCount(db, comp.id), 0)
  assert.equal((await pc())?.quantityIssued, 0)
  const closed = await db.issuance.findUniqueOrThrow({ where: { id: a.id } })
  assert.equal(closed.conditionOnReturn, "LOST")

  // Can't return twice, over-return, or return before issue date.
  await rejects(run((tx) => returnUnits(tx, { id: a.id, quantity: 1, condition: "WORKING", returnedDate: parseDateInput("2026-01-23"), notes: null })), /already been returned/)
  const b = await run((tx) => issue(tx, { ...base, quantity: 2, projectId: null }))
  await rejects(run((tx) => returnUnits(tx, { id: b.id, quantity: 3, condition: "WORKING", returnedDate: parseDateInput("2026-01-23"), notes: null })), /Only 2/)
  await rejects(run((tx) => returnUnits(tx, { id: b.id, quantity: 1, condition: "WORKING", returnedDate: parseDateInput("2026-01-01"), notes: null })), /before the issue date/)

  // Validators reject impossible dates and oversized input from crafted requests.
  const issueForm = { componentId: "c", quantity: "1", issuedToMemberId: "m", projectId: "none", issuedDate: "2026-01-10", expectedReturnDate: "", notes: "" }
  assert.ok(issueSchema.safeParse(issueForm).success)
  for (const issuedDate of ["2026-02-31", "2026-13-01", "10-01-2026"]) {
    assert.ok(!issueSchema.safeParse({ ...issueForm, issuedDate }).success, issuedDate)
  }
  assert.ok(!issueSchema.safeParse({ ...issueForm, quantity: "1e12" }).success)
  assert.ok(!issueSchema.safeParse({ ...issueForm, expectedReturnDate: "2026-01-01" }).success) // before issue date
  const projectForm = { title: "P", teamId: "none", status: "PLANNING", progressPercent: "0", startDate: "", targetDate: "", description: "" }
  const stack = (languages: string) => ({ languages, frameworks: "", hardware: "", tools: "", cloud: "" })
  const ok = projectCreateSchema.safeParse({ ...projectForm, techStack: stack("C, Python, Python , ") })
  assert.ok(ok.success && ok.data.techStack.languages.join() === "C,Python")
  assert.ok(!projectCreateSchema.safeParse({ ...projectForm, techStack: stack(Array.from({ length: 31 }, (_, i) => `t${i}`).join(",")) }).success)

  console.log("✓ stock logic and validator checks passed")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await db.$disconnect()
  })
