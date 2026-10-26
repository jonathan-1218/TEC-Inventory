// One-off: loads the club's old borrowing sheet (exported as a "|" file, see PSV below) into Issuances.
//   npx tsx --env-file=.env scripts/import-history.ts <file.psv>           dry run: prints what it would do
//   npx tsx --env-file=.env scripts/import-history.ts <file.psv> --apply   writes it (refuses to run twice)
// Columns: name|year|dept|component|qty|borrow date|return date|reason|returned (TRUE/FALSE). A blank name means
// "same borrower as the row above". Borrowers become guest Members (roll no. HIST-001…), components missing from
// the inventory are added with the borrowed units as their stock, and unreturned loans stay open.
import { readFileSync } from "node:fs"
import { PrismaClient, type Category } from "@prisma/client"

const MARK = "[old sheet]"
const db = new PrismaClient()
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")
const ALIAS: Record<string, string> = { ESP32CAMOV2640CAMERA: "", ESP32: "ESP32", GPS: "GPS MODULE", JETSONNANO2GBDEVELOPERKIT: "JETSON NANO", RASPBERRYPI: "RASPBERRY PI 3B PLUS", RASPBERRYPI3: "RASPBERRY PI 3B PLUS", RASPBERRYPI3BPLUS: "RASPBERRY PI 3B PLUS" }

const CATEGORY: [RegExp, Category][] = [
  [/ARDUINO|ESP|RASPBERRY|JETSON|AMB82|MSP430|KIT/, "MICROCONTROLLER"],
  [/SENSOR|CAMERA|WEBCAM|EEG|ECG|HEART|RFID|GPS|MIC|BIO AMP/, "SENSOR"],
  [/MOTOR|RELAY|DRIVER|L293/, "ACTUATOR_MOTOR"],
  [/BATTERY|RPS/, "POWER"],
  [/BLUETOOTH|BLE|WIFI|GSM|ETHERNET|TRANSMITTER/, "COMMUNICATION"],
  [/DISPLAY|LCD/, "DISPLAY"],
  [/IRON|STRIP|CABLE|WIRE|BREADBOARD|JUMPER/, "TOOL"],
]
const category = (n: string): Category => CATEGORY.find(([re]) => re.test(n))?.[1] ?? "MISC"

/** DD-MM-YYYY, or "Jan 2023" style; anything else (-, 15-0-2019) is unknown. */
function parseDate(s: string | undefined): Date | null {
  s = (s ?? "").trim()
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 6, 30))
  m = s.match(/^([A-Za-z]{3})[a-z]* (\d{4})$/)
  const mon = m ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase()) : -1
  return m && mon >= 0 ? new Date(Date.UTC(+m[2], mon, 15, 6, 30)) : null
}

type Row = { person: string; year: number; dept: string; component: string; qty: number; issued: Date; due: Date | null; returned: Date | null; open: boolean; notes: string }

function parse(file: string): Row[] {
  const rows: Row[] = []
  let head: { name: string; year: string; dept: string; issued: Date | null; due: string; reason: string; returned: boolean } | null = null
  for (const line of readFileSync(file, "utf8").trim().split("\n")) {
    const [name, year, dept, comp, qty, borrow, ret, reason, flag] = line.split("|").map((x) => x.trim())
    if (name) head = { name, year, dept, issued: parseDate(borrow), due: ret, reason, returned: flag === "TRUE" }
    if (!head || !comp) continue
    const notes: string[] = [MARK]
    if (name) head.issued = parseDate(borrow)
    let issued = parseDate(borrow) ?? head.issued
    if (issued && issued > new Date()) {
      notes.push(`sheet date ${borrow} is in the future, used the group's date`)
      issued = head.issued && head.issued <= new Date() ? head.issued : null
    }
    if (!issued) notes.push("borrow date unknown")
    issued ??= new Date(Date.UTC(2019, 0, 1, 6, 30))
    const reasonText = head.reason && head.reason !== "-" ? head.reason : ""
    if (reasonText) notes.push(reasonText)
    const retDate = parseDate(head.due)
    const returned = head.returned ? (retDate ?? issued) : null
    if (head.returned && !retDate) notes.push("return date unknown")
    rows.push({
      person: head.name,
      year: Number(head.year) || 1,
      dept: head.dept && head.dept !== "-" ? head.dept : "Unknown",
      component: comp.replace(/\s+/g, " "),
      qty: Number(qty) || 1,
      issued,
      due: head.returned ? null : retDate && retDate >= issued ? retDate : null,
      returned,
      open: !head.returned,
      notes: notes.join(" · "),
    })
  }
  return rows
}

async function main() {
  const [file, flag] = process.argv.slice(2)
  const apply = flag === "--apply"
  const rows = parse(file)
  console.log("database:", new URL(process.env.DATABASE_URL!).host)
  if (apply && (await db.issuance.count({ where: { notes: { startsWith: MARK } } }))) throw new Error("Already imported (rows tagged " + MARK + " exist).")

  const comps = await db.component.findMany()
  const byKey = new Map(comps.map((c) => [norm(c.name), c]))
  const pick = (n: string) => byKey.get(norm(ALIAS[norm(n)] ?? n)) ?? byKey.get(norm(n))
  const members = await db.member.findMany({ select: { id: true, name: true } })
  const memberByName = new Map(members.map((m) => [m.name.trim().toUpperCase(), m.id]))

  const newComps = new Map<string, { name: string; qty: number }>()
  const people = [...new Set(rows.map((r) => r.person))]
  const newPeople = people.filter((p) => !memberByName.has(p.toUpperCase()))
  const openByExisting = new Map<string, number>()
  for (const r of rows) {
    const c = pick(r.component)
    if (c) {
      if (r.open) openByExisting.set(c.name, (openByExisting.get(c.name) ?? 0) + r.qty)
    } else {
      const k = norm(r.component)
      newComps.set(k, { name: r.component, qty: (newComps.get(k)?.qty ?? 0) + (r.open ? r.qty : 0) })
    }
  }
  console.log(`${rows.length} loans · ${rows.filter((r) => r.open).length} still open · ${people.length} borrowers (${newPeople.length} new guests, ${people.length - newPeople.length} already members)`)
  console.log(`${newComps.size} new components:`, [...newComps.values()].map((c) => `${c.name}(${c.qty})`).join(", "))
  console.log("extra units now out of existing components:", Object.fromEntries(openByExisting))
  console.log("rows with notes:", rows.filter((r) => r.notes.includes("unknown") || r.notes.includes("future")).map((r) => `${r.person}/${r.component}: ${r.notes}`).join("\n  "))
  if (!apply) return console.log("\n(dry run — nothing written)")

  await db.$transaction(
    async (tx) => {
      const compId = new Map<string, string>()
      for (const [k, c] of newComps) {
        const made = await tx.component.create({
          data: { name: c.name, category: category(c.name), quantityTotal: c.qty, quantityWorking: c.qty, notes: "Added from the old borrowing sheet; set the real stock." },
        })
        compId.set(k, made.id)
      }
      const memberId = new Map(memberByName)
      let n = 0
      for (const p of newPeople) {
        const first = rows.find((r) => r.person === p)!
        const m = await tx.member.create({
          data: { name: p, rollNumber: `HIST-${String(++n).padStart(3, "0")}`, department: first.dept, yearOfStudy: first.year, guest: true, isActive: false, bio: "From the old borrowing sheet (no register number)." },
        })
        memberId.set(p.toUpperCase(), m.id)
      }
      for (const r of rows) {
        await tx.issuance.create({
          data: {
            componentId: pick(r.component)?.id ?? compId.get(norm(r.component))!,
            quantity: r.qty,
            issuedToMemberId: memberId.get(r.person.toUpperCase())!,
            issuedDate: r.issued,
            expectedReturnDate: r.due,
            returnedDate: r.returned,
            conditionOnReturn: r.returned ? "WORKING" : null,
            notes: r.notes,
          },
        })
      }
    },
    { timeout: 60_000 }
  )
  console.log("imported.")
}
main().finally(() => db.$disconnect())
