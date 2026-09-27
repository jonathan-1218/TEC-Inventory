import { cookies } from "next/headers"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const ADMIN_COOKIE = "tec_admin"

// Session cookie = HMAC(ADMIN_PASSWORD, fixed label). Can't be forged without the password,
// and changing ADMIN_PASSWORD logs everyone out.
function sessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return null
  return createHmac("sha256", password).update("tec-admin-session").digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match.
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function checkPassword(password: string): string | null {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || !safeEqual(password, expected)) return null
  return sessionToken()
}

export async function isAdmin(): Promise<boolean> {
  const token = sessionToken()
  if (!token) return false
  const value = (await cookies()).get(ADMIN_COOKIE)?.value
  return !!value && safeEqual(value, token)
}
