/**
 * Live mirror of the inventory into a Google Sheet ("Components" tab), one-way: app → sheet.
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
import { CATEGORY_LABELS } from "@/lib/labels"

const TAB = "Components"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API = "https://sheets.googleapis.com/v4/spreadsheets"
// ponytail: fixed to the club's timezone (Vercel runs in UTC); make it an env var if the club ever moves.
const TIME_ZONE = "Asia/Kolkata"

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

const STOCK_LABELS = { ok: "In stock", low: "Low stock", out: "Out of stock" } as const
const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short", hourCycle: "h23" })
    .format(d)
    .replace(",", "")

export const SHEET_HEADER = [
  "Name", "Model number", "Category", "Stock status", "Available", "Issued", "Working", "Damaged",
  "Under repair", "Total", "Low-stock threshold", "Location", "Unit cost", "Datasheet URL", "Description",
  "Notes", "Created", "Last updated", "ID",
]

/** Header + one row per component. Numbers stay numbers so the sheet can sum and chart them. */
export function componentRows(components: ComponentWithStock[]): (string | number)[][] {
  return [
    SHEET_HEADER,
    ...components.map((c) => [
      c.name,
      c.modelNumber ?? "",
      CATEGORY_LABELS[c.category],
      STOCK_LABELS[c.stockStatus],
      c.quantityAvailable,
      c.quantityIssued,
      c.quantityWorking,
      c.quantityDamaged,
      c.quantityUnderRepair,
      c.quantityTotal,
      c.lowStockThreshold,
      c.location ?? "",
      c.unitCost ?? "",
      c.datasheetUrl ?? "",
      c.description ?? "",
      c.notes ?? "",
      stamp(c.createdAt),
      stamp(c.updatedAt),
      c.id,
    ]),
  ]
}

const range = (sheetId: string, a1: string) => `${API}/${sheetId}/values/${encodeURIComponent(`${TAB}!${a1}`)}`
let tabReady: string | null = null

async function ensureTab(cfg: SheetsConfig, token: string) {
  if (tabReady === cfg.sheetId) return
  const meta = (await api(token, "GET", `${API}/${cfg.sheetId}?fields=sheets.properties.title`)) as {
    sheets?: { properties?: { title?: string } }[]
  }
  if (!meta.sheets?.some((s) => s.properties?.title === TAB)) {
    await api(token, "POST", `${API}/${cfg.sheetId}:batchUpdate`, {
      requests: [{ addSheet: { properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } } }],
    })
  }
  tabReady = cfg.sheetId
}

/** Rewrite the Components tab from the database. Returns null when syncing isn't configured. */
export async function syncComponentsToSheet(): Promise<{ rows: number; url: string } | null> {
  const cfg = sheetsConfig()
  if (!cfg) return null
  const [components, issued] = await Promise.all([
    db.component.findMany({ orderBy: { name: "asc" } }),
    issuedCounts(db),
  ])
  return pushRowsToSheet(cfg, componentRows(components.map((c) => withStock(c, issued.get(c.id) ?? 0))))
}

/** Replace the Components tab's contents with `rows` (header first). */
export async function pushRowsToSheet(cfg: SheetsConfig, rows: (string | number)[][]) {
  const token = await accessToken(cfg)
  await ensureTab(cfg, token)
  // RAW: values are stored as typed, so a part named "=IMPORTXML(...)" stays text, never a formula.
  await api(token, "PUT", `${range(cfg.sheetId, "A1")}?valueInputOption=RAW`, { values: rows })
  // Clear whatever sat below the new last row (deleted components) — no blank-sheet flash in between.
  await api(token, "POST", `${range(cfg.sheetId, `A${rows.length + 1}:ZZ`)}:clear`, {})
  return { rows: rows.length - 1, url: sheetUrl(cfg.sheetId) }
}

/**
 * Queue a sync to run after the response is sent, so saving never waits on Google.
 * ponytail: every admin change triggers one (3 small API calls) rather than tracking which actions touch
 * components — issue/return change the Available/Issued columns too, and nothing can be missed this way.
 * Two near-simultaneous changes can finish out of order; the next change or "Sync to Sheets" corrects it.
 */
export function scheduleSheetSync() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return
  after(async () => {
    try {
      await syncComponentsToSheet()
    } catch (e) {
      console.error("[sheets] sync failed:", e instanceof Error ? e.message : e)
    }
  })
}
