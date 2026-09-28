/**
 * Self-check for the issue/return stock logic, task ordering, CSV escaping, series helpers and input validation. Runs in a throwaway
 * Postgres schema inside the configured database (DIRECT_URL) and drops it afterwards.
 *   npm run check
 */
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { extendDue, issue, issuedCount, returnUnits } from "@/lib/stock"
import { completedAtFor, createTask, moveTask, setTaskDone, updateTask } from "@/lib/tasks"
import { dayKeys, levelByDay, sumByDay } from "@/lib/analytics"
import { csvCell, toCsv } from "@/app/api/export/[entity]/csv"
import { ActionError } from "@/lib/action-error"
import { parseDateInput, toDateInput, todayNoonUTC } from "@/lib/dates"
import { extendDueSchema, issueSchema, projectCreateSchema, taskUpdateSchema } from "@/lib/validators"

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

  // Extend due date: open issuances only, never before the issue date; the schema blocks past dates.
  await run((tx) => extendDue(tx, { id: b.id, expectedReturnDate: parseDateInput("2026-02-01") }))
  assert.equal(toDateInput((await db.issuance.findUniqueOrThrow({ where: { id: b.id } })).expectedReturnDate), "2026-02-01")
  await rejects(run((tx) => extendDue(tx, { id: b.id, expectedReturnDate: parseDateInput("2026-01-01") })), /before the issue date/)
  await rejects(run((tx) => extendDue(tx, { id: a.id, expectedReturnDate: parseDateInput("2026-02-01") })), /already been returned/)
  const today = todayNoonUTC()
  assert.ok(extendDueSchema.safeParse({ id: "x", expectedReturnDate: toDateInput(today) }).success)
  assert.ok(!extendDueSchema.safeParse({ id: "x", expectedReturnDate: toDateInput(new Date(today.getTime() - 86_400_000)) }).success)
  assert.ok(!extendDueSchema.safeParse({ id: "x", expectedReturnDate: "2099-02-30" }).success)

  // Tasks: new ones append to their column; moves renumber the target column; completedAt follows DONE.
  const task = (title: string, status: "TODO" | "DONE" = "TODO") =>
    run((tx) => createTask(tx, { projectId: project.id, title, description: null, status, priority: "MEDIUM", assigneeId: null, dueDate: null }))
  const col = async (status: "TODO" | "IN_PROGRESS" | "DONE") => {
    const rows = await db.task.findMany({ where: { projectId: project.id, status }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
    return rows.map((t) => t.title).join()
  }
  const orders = async (status: "TODO" | "DONE") =>
    (await db.task.findMany({ where: { projectId: project.id, status }, orderBy: { order: "asc" } })).map((t) => t.order).join()
  const getTask = (id: string) => db.task.findUniqueOrThrow({ where: { id } })
  const [ta, tb, tc] = [await task("a"), await task("b"), await task("c")]
  assert.deepEqual([ta.order, tb.order, tc.order, ta.completedAt], [0, 1, 2, null])
  await run((tx) => moveTask(tx, { id: tc.id, status: "TODO", order: 0 }))
  assert.equal(await col("TODO"), "c,a,b")
  await run((tx) => moveTask(tx, { id: tc.id, status: "TODO", order: 2 })) // like arrayMove(0 -> 2)
  assert.equal(await col("TODO"), "a,b,c")
  assert.equal(await orders("TODO"), "0,1,2")
  await run((tx) => moveTask(tx, { id: ta.id, status: "DONE", order: 99 })) // clamped
  const doneA = await getTask(ta.id)
  assert.ok(doneA.completedAt && doneA.order === 0)
  const td = await task("d", "DONE")
  assert.ok(td.completedAt && td.order === 1)
  await run((tx) => moveTask(tx, { id: td.id, status: "DONE", order: 0 }))
  assert.equal(await col("DONE"), "d,a")
  assert.equal((await getTask(ta.id)).completedAt?.getTime(), doneA.completedAt.getTime()) // reorder keeps the stamp
  await run((tx) => moveTask(tx, { id: tb.id, status: "IN_PROGRESS", order: 0 }))
  assert.equal(await col("IN_PROGRESS"), "b")
  await run((tx) => setTaskDone(tx, { id: ta.id, done: false }))
  assert.equal((await getTask(ta.id)).completedAt, null)
  assert.equal(await col("TODO"), "c,a")
  await run((tx) => setTaskDone(tx, { id: tb.id, done: true }))
  assert.equal(await col("DONE"), "d,b")
  assert.equal(await orders("DONE"), "0,1")
  await run((tx) => updateTask(tx, { id: tc.id, status: "DONE" })) // status edit appends + stamps
  assert.equal(await col("DONE"), "d,b,c")
  assert.ok((await getTask(tc.id)).completedAt)
  await run((tx) => updateTask(tx, { id: tc.id, title: "c2" })) // partial edit keeps the rest
  assert.deepEqual([(await getTask(tc.id)).status, await col("DONE")], ["DONE", "d,b,c2"])
  assert.deepEqual(taskUpdateSchema.parse({ id: "x", title: "t" }), { id: "x", title: "t" })
  assert.equal(taskUpdateSchema.parse({ id: "x", assigneeId: "none", dueDate: "" }).assigneeId, null)
  await rejects(run((tx) => createTask(tx, { projectId: "nope", title: "x", description: null, status: "TODO", priority: "LOW", assigneeId: null, dueDate: null })), /Project not found/)
  await rejects(run((tx) => moveTask(tx, { id: "nope", status: "TODO", order: 0 })), /Task not found/)
  const stamp = new Date("2026-01-01T10:00:00Z")
  assert.equal(completedAtFor({ status: "DONE", completedAt: stamp }, "DONE"), stamp)
  assert.equal(completedAtFor({ status: "DONE", completedAt: stamp }, "TODO"), null)
  assert.ok(completedAtFor({ status: "IN_PROGRESS", completedAt: null }, "DONE"))

  // CSV: RFC 4180 quoting and formula-injection guard (numbers stay numbers).
  assert.equal(csvCell('0.96" OLED, I²C'), '"0.96"" OLED, I²C"')
  assert.equal(csvCell("line 1\nline 2"), '"line 1\nline 2"')
  for (const f of ["=SUM(A1)", "+91 98450", "-2+3", "@cmd", "\tx"]) assert.equal(csvCell(f)[0], "'", f)
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.deepEqual([csvCell(-5), csvCell(null), csvCell(undefined), csvCell(parseDateInput("2026-01-10"))], ["-5", "", "", "2026-01-10"])
  assert.equal(toCsv(["a", "b"], [[1, null], ["x,y", true]]), 'a,b\r\n1,\r\n"x,y",true\r\n')

  // Series helpers: every day present, zero-filled; spans count from <= day < to.
  const keys = dayKeys(3, parseDateInput("2026-03-01"))
  assert.deepEqual(keys, ["2026-02-27", "2026-02-28", "2026-03-01"])
  const events: [string | null, number][] = [["2026-02-28", 2], ["2026-02-28", 1], ["2026-01-01", 5], [null, 9]]
  assert.deepEqual(sumByDay(keys, events, (e) => e), [0, 3, 0])
  const spans: [string | null, string | null, number][] = [["2026-02-28", null, 1], [null, "2026-02-28", 3], ["2026-02-27", "2026-02-27", 9]]
  assert.deepEqual(levelByDay(keys, spans, (s) => s), [3, 1, 1])
  assert.equal(dayKeys(90).length, 90)
  assert.equal(dayKeys(1)[0], toDateInput(todayNoonUTC()))

  console.log("✓ stock logic, task ordering, CSV, series and validator checks passed")
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
