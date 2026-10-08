import { cache } from "react"
import { cookies } from "next/headers"
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { db } from "@/lib/db"

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const TEAM_COOKIE = "tec_team"

/** "scrypt$<salt hex>$<hash hex>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 32)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, hash] = stored.split("$")
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, "hex")
  const actual = await scrypt(password, Buffer.from(salt, "hex"), expected.length || 32)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Signed with SESSION_SECRET (falls back to ADMIN_PASSWORD so no new env var is required). The password
// hash is mixed in, so a password change or account deletion ends every session for that account.
function sign(accountId: string, passwordHash: string): string | null {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!secret) return null
  return createHmac("sha256", secret).update(`team:${accountId}:${passwordHash}`).digest("hex")
}

export function sessionValue(accountId: string, passwordHash: string): string | null {
  const sig = sign(accountId, passwordHash)
  return sig && `${accountId}.${sig}`
}

export type TeamSession = { accountId: string; email: string; projectId: string; projectTitle: string }

/** The signed-in, approved team account (one DB read per request, only when the cookie is present). */
export const teamSession = cache(async (): Promise<TeamSession | null> => {
  const value = (await cookies()).get(TEAM_COOKIE)?.value
  const [accountId, sig] = value?.split(".") ?? []
  if (!accountId || !sig) return null
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { email: true, passwordHash: true, approvedAt: true, project: { select: { id: true, title: true } } },
  })
  if (!account?.approvedAt || !account.project) return null
  const expected = sign(accountId, account.passwordHash)
  if (!expected || expected.length !== sig.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return { accountId, email: account.email, projectId: account.project.id, projectTitle: account.project.title }
})
