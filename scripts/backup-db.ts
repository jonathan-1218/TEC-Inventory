// Read-only JSON snapshot of every table to ~/.config/tec-inventory/backups/ (outside the repo).
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const dir = join(homedir(), ".config", "tec-inventory", "backups")
mkdirSync(dir, { recursive: true, mode: 0o700 })
async function main() {
  const out: Record<string, unknown[]> = {}
  for (const key of Object.keys(db)) {
    const model = (db as unknown as Record<string, { findMany?: () => Promise<unknown[]> }>)[key]
    if (key.startsWith("$") || key.startsWith("_") || typeof model?.findMany !== "function") continue
    out[key] = await model.findMany()
  }
  const file = join(dir, `full-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`)
  writeFileSync(file, JSON.stringify(out, null, 1), { mode: 0o600 })
  console.log(file, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])))
  await db.$disconnect()
}
main()
