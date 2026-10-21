/**
 * Live mirror of the inventory into the club's existing Google Sheet, one-way: app → sheet. It fills two tabs' own
 * tables — COMPONENTS (COMPONENT NAME · TOTAL · TYPE · TEC CLUB USAGE · USED QTY · RETURN STATUS · AVAILABLE QTY ·
 * PURPOSE · PROJECT NAME) and CHECK-LIST (REG. NO. · NAME · COMPONENT · QTY · PURPOSE · COLLECTED DATE · RETURN
 * STATUS · RETURN DATE) — and leaves the headers, formatting and every other tab alone.
 *
 * Auth is a Google service account (server-to-server, no browser login): we sign a JWT with Node's crypto and
 * trade it for an access token. Each sync rewrites the whole tab from the database, so the sheet can't drift —
 * a missed or failed sync is healed by the next change or the admin "Sync to Sheets" button.
 *
 * Env: GOOGLE_SHEET_ID (the id, or the whole sheet URL) and GOOGLE_SERVICE_ACCOUNT_KEY (the service account's
 * JSON key file, raw or base64). Unset → syncing is off and nothing here runs.
 */
import { createSign } from "node:crypto"
import { after } from "next/server"
import { db } from "@/lib/db"
import { issuedCounts } from "@/lib/stock"
import { withStock, type ComponentWithStock } from "@/lib/queries"
import type { Category } from "@prisma/client"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API = "https://sheets.googleapis.com/v4/spreadsheets"

type Env = Record<string, string | undefined>
export type SheetsConfig = { sheetId: string; email: string; privateKey: string }

export function sheetsConfig(env: Env = process.env): SheetsConfig | null {
  const idOrUrl = env.GOOGLE_SHEET_ID?.trim()
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  if (!idOrUrl || !rawKey) return null
  const sheetId = sheetIdFrom(idOrUrl)
  let key: { client_email?: string; private_key?: string }
  try {
    key = JSON.parse(rawKey.startsWith("{") ? rawKey : Buffer.from(rawKey, "base64").toString("utf8"))
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY isn't valid JSON (or base64 of it) — paste the whole key file.")
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email/private_key — use a service account key file.")
  }
  return { sheetId, email: key.client_email, privateKey: key.private_key }
}

const sheetIdFrom = (idOrUrl: string) => idOrUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? idOrUrl
export const sheetUrl = (sheetId: string) => `https://docs.google.com/spreadsheets/d/${sheetId}/edit`

/** Link to the mirrored sheet when syncing is configured (doesn't touch the key, so it never throws). */
export function configuredSheetUrl(env: Env = process.env): string | null {
  const idOrUrl = env.GOOGLE_SHEET_ID?.trim()
  return idOrUrl && env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim() ? sheetUrl(sheetIdFrom(idOrUrl)) : null
}

/** RS256 JWT for Google's service-account token exchange. */
export function signJwt(email: string, privateKey: string, now = Math.floor(Date.now() / 1000)) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`
  return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url")}`
}

// One token per warm function instance; Google issues them for an hour.
let cachedToken: { email: string; token: string; expiresAt: number } | null = null

async function accessToken(cfg: SheetsConfig): Promise<string> {
  if (cachedToken?.email === cfg.email && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(cfg.email, cfg.privateKey),
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !body.access_token) throw new Error(`Google auth failed: ${body.error_description ?? res.status}`)
  cachedToken = { email: cfg.email, token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return body.access_token
}

async function api(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message
    const hint = res.status === 403 ? " — share the sheet with the service account email as an Editor" : ""
    throw new Error(`Google Sheets ${res.status}: ${detail ?? res.statusText}${hint}`)
  }
  return res.json() as Promise<unknown>
}

type Cell = string | number | boolean

/** The sheet's TYPE dropdown (a strict list) → the app's categories. Several types share a category. */
export const TYPE_TO_CATEGORY: Record<string, Category> = {
  "MICRO CONTROLLERS": "MICROCONTROLLER",
  "DEVELOPMENT KITS": "MICROCONTROLLER",
  SENSORS: "SENSOR",
  WIRES: "CONSUMABLE",
  TOOLS: "TOOL",
  BATTERIES: "POWER",
  TRANSFORMERS: "POWER",
  ADAPTORS: "POWER",
  RELAYS: "ACTUATOR_MOTOR",
  OTHER: "MISC",
}
/** App category → the closest TYPE in the sheet's dropdown. */
const CATEGORY_TO_TYPE: Record<Category, string> = {
  MICROCONTROLLER: "MICRO CONTROLLERS",
  SENSOR: "SENSORS",
  ACTUATOR_MOTOR: "OTHER",
  POWER: "BATTERIES",
  COMMUNICATION: "OTHER",
  DISPLAY: "OTHER",
  TOOL: "TOOLS",
  CONSUMABLE: "WIRES",
  MISC: "OTHER",
}

export const categoryFromType = (type: string): Category => TYPE_TO_CATEGORY[type.trim().toUpperCase()] ?? "MISC"

/**
 * TYPE to write for a component. Keeps what the sheet already says while it still maps to the app's category,
 * so "DEVELOPMENT KITS", "TRANSFORMERS" or a blank aren't flattened to the closest type on every sync; only a
 * category change in the app rewrites it.
 */
export function typeFor(category: Category, current: string | undefined): string {
  const known = current !== undefined && (current === "" || current.trim().toUpperCase() in TYPE_TO_CATEGORY)
  return known && categoryFromType(current) === category ? current : CATEGORY_TO_TYPE[category]
}

/** A tab we own: its name, the exact header we expect in row 1, and an empty table row (checkboxes unticked). */
type TabSpec = { tab: string; header: string[]; blank: Cell[] }

export const SHEET_HEADER = [
  "COMPONENT NAME", "TOTAL", "TYPE", "TEC CLUB USAGE", "USED QTY", "RETURN STATUS", "AVAILABLE QTY", "PURPOSE", "PROJECT NAME",
]
const COMPONENTS: TabSpec = { tab: "COMPONENTS", header: SHEET_HEADER, blank: ["", "", "", false, "", false, "", "", ""] }

export const CHECKLIST_HEADER = ["REG. NO.", "NAME", "COMPONENT", "QTY", "PURPOSE", "COLLECTED DATE", "RETURN STATUS", "RETURN DATE"]
const CHECKLIST: TabSpec = { tab: "CHECK-LIST", header: CHECKLIST_HEADER, blank: ["", "", "", "", "", "", false, ""] }

const colLetter = (n: number) => String.fromCharCode(64 + n)
export const sheetKey = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase()

/** A component's checkout history, as far as the sheet needs it. */
export type Use = { notes: string | null; project: string | null }
export type Usage = { open: Use[]; latest: Use | null }

const joinUnique = (xs: (string | null)[]) => [...new Set(xs.map((x) => x?.trim()).filter(Boolean))].join("; ")

/**
 * One table row per component (header excluded). TEC CLUB USAGE = it has ever been checked out; USED QTY = units
 * out right now; RETURN STATUS = everything has come back; PURPOSE / PROJECT NAME = the open checkouts' notes and
 * projects, or the most recent checkout's once all are back.
 */
export function clubRows(components: ComponentWithStock[], usage: Map<string, Usage>, currentTypes: Map<string, string>): Cell[][] {
  return components.map((c) => {
    const u = usage.get(c.id)
    const used = Boolean(u?.latest)
    const shown = u?.open.length ? u.open : u?.latest ? [u.latest] : []
    return [
      c.name,
      c.quantityTotal,
      typeFor(c.category, currentTypes.get(sheetKey(c.name))),
      used,
      used ? c.quantityIssued : "",
      used && c.quantityIssued === 0,
      c.quantityAvailable,
      joinUnique(shown.map((s) => s.notes)),
      joinUnique(shown.map((s) => s.project)),
    ]
  })
}

const values = (sheetId: string, tab: string, a1: string) => `${API}/${sheetId}/values/${encodeURIComponent(`'${tab}'!${a1}`)}`

type TableInfo = { gid: number; tableId?: string; endRowIndex: number }

/** A tab, its table (rows from A1) and its current values; refuses if the header isn't the one we expect. */
async function readTab(cfg: SheetsConfig, token: string, spec: TabSpec): Promise<{ table: TableInfo; grid: Cell[][] }> {
  const { tab: TAB, header: HEADER } = spec
  const last = colLetter(HEADER.length)
  const [meta, grid] = (await Promise.all([
    api(token, "GET", `${API}/${cfg.sheetId}?fields=sheets(properties(sheetId,title),tables(tableId,range))`),
    api(token, "GET", `${values(cfg.sheetId, TAB, `A1:${last}`)}?valueRenderOption=UNFORMATTED_VALUE`),
  ])) as [
    { sheets?: { properties?: { sheetId?: number; title?: string }; tables?: { tableId?: string; range?: { startRowIndex?: number; startColumnIndex?: number; endRowIndex?: number } }[] }[] },
    { values?: Cell[][] },
  ]
  const tab = meta.sheets?.find((s) => s.properties?.title === TAB)
  if (!tab) throw new Error(`The sheet has no "${TAB}" tab.`)
  const header = (grid.values?.[0] ?? []).map((h) => String(h).trim().toUpperCase())
  if (HEADER.some((h, i) => header[i] !== h)) {
    // Refuse rather than write numbers under the wrong headings if someone reorders or renames the columns.
    throw new Error(`"${TAB}" columns changed — expected ${HEADER.join(" · ")} in A1:${last}1.`)
  }
  const table = tab.tables?.find((t) => !t.range?.startRowIndex && !t.range?.startColumnIndex)
  const rows = grid.values?.length ?? 1
  return {
    table: { gid: tab.properties?.sheetId ?? 0, tableId: table?.tableId, endRowIndex: table?.range?.endRowIndex ?? rows },
    grid: grid.values ?? [],
  }
}

/** The COMPONENTS tab, plus the TYPE currently shown for each component name. */
async function readSheet(cfg: SheetsConfig, token: string): Promise<{ table: TableInfo; currentTypes: Map<string, string> }> {
  const { table, grid } = await readTab(cfg, token, COMPONENTS)
  // First occurrence wins for duplicate names — the same rule the one-off import used.
  const currentTypes = new Map<string, string>()
  for (const r of grid.slice(1)) {
    const key = sheetKey(String(r[0] ?? ""))
    if (key && !currentTypes.has(key)) currentTypes.set(key, String(r[2] ?? ""))
  }
  return { table, currentTypes }
}

/**
 * Write the rows under the header. The table keeps its size: unused rows below are blanked (checkboxes unticked),
 * and it grows if there are more components than rows — so formatting, dropdowns and checkboxes stay intact.
 */
async function writeTable(cfg: SheetsConfig, token: string, spec: TabSpec, table: TableInfo, rows: Cell[][]) {
  const WIDTH = spec.header.length
  const height = Math.max(table.endRowIndex - 1, rows.length)
  if (table.tableId && rows.length + 1 > table.endRowIndex) {
    await api(token, "POST", `${API}/${cfg.sheetId}:batchUpdate`, {
      requests: [{
        updateTable: {
          table: { tableId: table.tableId, range: { sheetId: table.gid, startRowIndex: 0, endRowIndex: rows.length + 1, startColumnIndex: 0, endColumnIndex: WIDTH } },
          fields: "range",
        },
      }],
    })
  }
  const body = [...rows, ...Array.from({ length: height - rows.length }, () => spec.blank)]
  // RAW: values are stored as typed, so a part named "=IMPORTXML(...)" stays text, never a formula.
  await api(token, "PUT", `${values(cfg.sheetId, spec.tab, `A2:${colLetter(WIDTH)}${height + 1}`)}?valueInputOption=RAW`, { values: body })
}

/** Rewrite the COMPONENTS table from the database. Returns null when syncing isn't configured. */
export async function syncComponentsToSheet(): Promise<{ rows: number; url: string } | null> {
  const cfg = sheetsConfig()
  if (!cfg) return null
  const [components, issued, issuances] = await Promise.all([
    db.component.findMany({ orderBy: { name: "asc" } }),
    issuedCounts(db),
    db.issuance.findMany({
      orderBy: { issuedDate: "desc" },
      select: { componentId: true, returnedDate: true, notes: true, project: { select: { title: true } } },
    }),
  ])
  const usage = new Map<string, Usage>()
  for (const i of issuances) {
    const u = usage.get(i.componentId) ?? { open: [], latest: null }
    const use = { notes: i.notes, project: i.project?.title ?? null }
    u.latest ??= use
    if (!i.returnedDate) u.open.push(use)
    usage.set(i.componentId, u)
  }
  const withCounts = components.map((c) => withStock(c, issued.get(c.id) ?? 0))
  return pushToSheet(cfg, (currentTypes) => clubRows(withCounts, usage, currentTypes))
}

/** Read the sheet, build rows (they need the TYPE currently shown), write them back. */
export async function pushToSheet(cfg: SheetsConfig, build: (currentTypes: Map<string, string>) => Cell[][]) {
  const token = await accessToken(cfg)
  const { table, currentTypes } = await readSheet(cfg, token)
  const rows = build(currentTypes)
  await writeTable(cfg, token, COMPONENTS, table, rows)
  return { rows: rows.length, url: sheetUrl(cfg.sheetId) }
}

type Loan = {
  quantity: number
  issuedDate: Date
  returnedDate: Date | null
  notes: string | null
  project: { title: string } | null
  component: { name: string }
  issuedTo: { name: string; rollNumber: string }
}
const day = (d: Date) => d.toISOString().slice(0, 10)

/**
 * One CHECK-LIST row per issuance record, oldest first: REG. NO. and NAME are the member's roll number and name,
 * PURPOSE the checkout's note (else its project), RETURN STATUS ticked once returned. A partial return leaves two
 * records (the part still out, the part back), so quantities always add up to what was issued.
 */
export function checklistRows(loans: Loan[]): Cell[][] {
  return loans.map((l) => [
    l.issuedTo.rollNumber,
    l.issuedTo.name,
    l.component.name,
    l.quantity,
    l.notes?.trim() || l.project?.title || "",
    day(l.issuedDate),
    l.returnedDate !== null,
    l.returnedDate ? day(l.returnedDate) : "",
  ])
}

/** Rewrite the CHECK-LIST table from the issuances. Header mismatch or a missing tab throws. */
export async function pushChecklist(cfg: SheetsConfig, rows: Cell[][]) {
  const token = await accessToken(cfg)
  const { table } = await readTab(cfg, token, CHECKLIST)
  await writeTable(cfg, token, CHECKLIST, table, rows)
  return { rows: rows.length }
}

export async function syncChecklistToSheet(): Promise<{ rows: number } | null> {
  const cfg = sheetsConfig()
  if (!cfg) return null
  const loans = await db.issuance.findMany({
    orderBy: [{ issuedDate: "asc" }, { createdAt: "asc" }],
    select: {
      quantity: true,
      issuedDate: true,
      returnedDate: true,
      notes: true,
      project: { select: { title: true } },
      component: { select: { name: true } },
      issuedTo: { select: { name: true, rollNumber: true } },
    },
  })
  return pushChecklist(cfg, checklistRows(loans))
}

/**
 * Queue a sync to run after the response is sent, so saving never waits on Google.
 * ponytail: every admin change triggers one (2 reads + 1 write) rather than tracking which actions touch
 * components — issue/return change the Available/Issued columns too, and nothing can be missed this way.
 * Two near-simultaneous changes can finish out of order; the next change or "Sync to Sheets" corrects it.
 */
export function scheduleSheetSync() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return
  after(async () => {
    // Independent: a problem with one tab (renamed header…) must not stop the other from syncing.
    for (const sync of [syncComponentsToSheet, syncChecklistToSheet]) {
      try {
        await sync()
      } catch (e) {
        console.error(`[sheets] ${sync.name} failed:`, e instanceof Error ? e.message : e)
      }
    }
  })
}
