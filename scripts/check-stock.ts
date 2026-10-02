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
import { createVerify, generateKeyPairSync } from "node:crypto"
import { categoryFromType, clubRows, configuredSheetUrl, pushToSheet, SHEET_HEADER, sheetsConfig, signJwt, typeFor } from "@/lib/sheets"
import { withStock } from "@/lib/queries"

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

  await checkSheets()

  console.log("✓ stock logic, task ordering, CSV, series, validator and Google Sheets checks passed")
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

/** Google Sheets mirror: config parsing, JWT, row shape, and the push flow against a fake Google API (no network). */
async function checkSheets() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const keyJson = JSON.stringify({ client_email: "tec-sync@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) })
  const url = "https://docs.google.com/spreadsheets/d/AbC-123_x/edit#gid=0"

  // Config: off when unset; accepts raw or base64 JSON and a full URL or bare id; rejects junk.
  assert.equal(sheetsConfig({}), null)
  assert.equal(configuredSheetUrl({ GOOGLE_SHEET_ID: url }), null)
  const raw = sheetsConfig({ GOOGLE_SHEET_ID: url, GOOGLE_SERVICE_ACCOUNT_KEY: keyJson })!
  const b64 = sheetsConfig({ GOOGLE_SHEET_ID: "AbC-123_x", GOOGLE_SERVICE_ACCOUNT_KEY: Buffer.from(keyJson).toString("base64") })!
  assert.equal(raw.sheetId, "AbC-123_x")
  assert.deepEqual(raw, b64)
  assert.equal(configuredSheetUrl({ GOOGLE_SHEET_ID: url, GOOGLE_SERVICE_ACCOUNT_KEY: "x" }), "https://docs.google.com/spreadsheets/d/AbC-123_x/edit")
  assert.throws(() => sheetsConfig({ GOOGLE_SHEET_ID: "a", GOOGLE_SERVICE_ACCOUNT_KEY: "not json" }), /valid JSON/)

  // JWT: verifies against the public key and carries the claims Google expects.
  const jwt = signJwt(raw.email, raw.privateKey, 1_000)
  const [h, c, sig] = jwt.split(".")
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, sig, "base64url"))
  const claims = JSON.parse(Buffer.from(c, "base64url").toString())
  assert.deepEqual(claims, { iss: raw.email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: 1_000, exp: 4_600 })

  // TYPE <-> category: closest-type mapping, and an existing compatible TYPE is kept rather than flattened.
  assert.equal(categoryFromType("DEVELOPMENT KITS"), "MICROCONTROLLER")
  assert.equal(categoryFromType(" relays "), "ACTUATOR_MOTOR")
  assert.equal(categoryFromType(""), "MISC")
  assert.equal(typeFor("MICROCONTROLLER", "DEVELOPMENT KITS"), "DEVELOPMENT KITS") // still compatible: kept
  assert.equal(typeFor("MICROCONTROLLER", undefined), "MICRO CONTROLLERS") // new part: closest type
  assert.equal(typeFor("MISC", ""), "") // blank stays blank while uncategorised
  assert.equal(typeFor("SENSOR", "DEVELOPMENT KITS"), "SENSORS") // category changed in the app: rewritten
  assert.equal(typeFor("MISC", "NONSENSE"), "OTHER")

  // Rows: the club layout; formula-looking text stays text (written RAW); usage columns from checkout history.
  const base = { id: "c1", name: "=IMPORTXML(1)", modelNumber: null, category: "SENSOR", description: null, quantityTotal: 5, quantityWorking: 4, quantityDamaged: 1, quantityUnderRepair: 0, location: "Box A", unitCost: 120, datasheetUrl: null, lowStockThreshold: 2, notes: null, createdAt: new Date(), updatedAt: new Date() } as const
  const parts = [withStock({ ...base }, 3), withStock({ ...base, id: "c2", name: "Arduino  Nano", category: "MICROCONTROLLER" }, 0), withStock({ ...base, id: "c3", name: "Spare" }, 0)]
  const usage = new Map([
    ["c1", { open: [{ notes: "Rover", project: "LFB" }, { notes: "Rover", project: "Garden" }], latest: { notes: "Rover", project: "LFB" } }],
    ["c2", { open: [], latest: { notes: "Competition", project: null } }],
  ])
  const rows = clubRows(parts, usage, new Map([["ARDUINO NANO", "DEVELOPMENT KITS"]]))
  const at = (r: number) => Object.fromEntries(SHEET_HEADER.map((k, i) => [k, rows[r][i]]))
  assert.deepEqual(at(0), { "COMPONENT NAME": "=IMPORTXML(1)", TOTAL: 5, TYPE: "SENSORS", "TEC CLUB USAGE": true, "USED QTY": 3, "RETURN STATUS": false, "AVAILABLE QTY": 1, PURPOSE: "Rover", "PROJECT NAME": "LFB; Garden" })
  assert.deepEqual(at(1), { "COMPONENT NAME": "Arduino  Nano", TOTAL: 5, TYPE: "DEVELOPMENT KITS", "TEC CLUB USAGE": true, "USED QTY": 0, "RETURN STATUS": true, "AVAILABLE QTY": 4, PURPOSE: "Competition", "PROJECT NAME": "" })
  assert.deepEqual(at(2), { "COMPONENT NAME": "Spare", TOTAL: 5, TYPE: "SENSORS", "TEC CLUB USAGE": false, "USED QTY": "", "RETURN STATUS": false, "AVAILABLE QTY": 4, PURPOSE: "", "PROJECT NAME": "" })

  // Push flow against a fake Google API: read tab + table + current TYPEs, then write under the header only,
  // blanking leftover table rows; grow the table when there are more parts than rows; refuse a changed header.
  const realFetch = globalThis.fetch
  const calls: string[] = []
  let written: { values: unknown[][] } | undefined
  const tableEnd = 3 // header + 2 rows
  let header = [...SHEET_HEADER]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = decodeURIComponent(String(input)), m = init?.method ?? "GET"
    calls.push(`${m} ${u.replace(/^https:\/\/[^/]+/, "").replace(/\?.*/, "")}`)
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    if (u.includes("oauth2")) return ok({ access_token: "tok", expires_in: 3600 })
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer tok")
    if (u.includes("FORBIDDEN")) return new Response(JSON.stringify({ error: { message: "denied" } }), { status: 403 })
    if (m === "GET" && u.includes("fields=sheets")) return ok({ sheets: [{ properties: { sheetId: 7, title: "CHECK-LIST" } }, { properties: { sheetId: 0, title: "COMPONENTS" }, tables: [{ tableId: "T1", range: { startRowIndex: 0, endRowIndex: tableEnd } }] }] })
    if (m === "GET") return ok({ values: [header, ["ARDUINO NANO", 2, "DEVELOPMENT KITS"]] })
    if (m === "PUT") written = JSON.parse(String(init?.body))
    if (m === "POST" && u.includes("batchUpdate")) {
      const req = JSON.parse(String(init?.body)).requests[0].updateTable
      assert.deepEqual(req, { table: { tableId: "T1", range: { sheetId: 0, startRowIndex: 0, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 9 } }, fields: "range" })
    }
    return ok({})
  }) as typeof fetch
  try {
    const cfg = { ...raw, sheetId: "S1" }
    // 1 part, table has 2 body rows → writes A2:I3 with the second row blanked.
    assert.deepEqual(await pushToSheet(cfg, (types) => clubRows([parts[1]], usage, types)), { rows: 1, url: "https://docs.google.com/spreadsheets/d/S1/edit" })
    assert.deepEqual(calls, ["POST /token", "GET /v4/spreadsheets/S1", "GET /v4/spreadsheets/S1/values/'COMPONENTS'!A1:I", "PUT /v4/spreadsheets/S1/values/'COMPONENTS'!A2:I3"])
    assert.equal(written!.values.length, 2)
    assert.equal(written!.values[0][2], "DEVELOPMENT KITS") // read back from the sheet and kept
    assert.deepEqual(written!.values[1], ["", "", "", false, "", false, "", "", ""])
    // 3 parts, table has 2 body rows → grow the table to 4 rows first, then write A2:I4.
    calls.length = 0
    await pushToSheet(cfg, (types) => clubRows(parts, usage, types))
    assert.deepEqual(calls.map((c) => c.split(" ")[0] + (c.includes("batchUpdate") ? ":grow" : "")), ["GET", "GET", "POST:grow", "PUT"])
    assert.equal(written!.values.length, 3)
    // Renamed/reordered columns → refuse to write.
    header = ["NAME", ...SHEET_HEADER.slice(1)]
    calls.length = 0
    await assert.rejects(pushToSheet(cfg, (types) => clubRows(parts, usage, types)), /columns changed/)
    assert.ok(!calls.some((c) => c.startsWith("PUT")))
    await assert.rejects(pushToSheet({ ...raw, sheetId: "FORBIDDEN" }, () => []), /403: denied — share the sheet with the service account/)
  } finally {
    globalThis.fetch = realFetch
  }
}
