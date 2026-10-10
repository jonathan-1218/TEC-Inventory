import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what Google Authenticator, Authy, 1Password etc. use.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP = 30

function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase()
  let bits = ""
  for (const c of clean) {
    const v = ALPHABET.indexOf(c)
    if (v < 0) throw new Error("ADMIN_TOTP_SECRET is not valid base32")
    bits += v.toString(2).padStart(5, "0")
  }
  return Buffer.from(bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? [])
}

export function newTotpSecret(): string {
  const bytes = randomBytes(20)
  let bits = ""
  for (const b of bytes) bits += b.toString(2).padStart(8, "0")
  return bits.match(/.{5}/g)!.map((b) => ALPHABET[parseInt(b, 2)]).join("")
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

/** The time step `code` matches (now ±1 step for clock drift), or null. */
export function matchTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const current = Math.floor(now / 1000 / STEP)
  for (const step of [current, current - 1, current + 1]) {
    if (timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))) return step
  }
  return null
}

export const totpUri = (secret: string, label = "TEC Inventory:admin") =>
  `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent("TEC Inventory")}&digits=6&period=${STEP}`
