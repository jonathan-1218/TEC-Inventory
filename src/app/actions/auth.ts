"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_COOKIE, checkPassword } from "@/lib/auth"
import { TEAM_COOKIE } from "@/lib/team-auth"
import { MINUTE, allowAll, clearLimit, clientIp } from "@/lib/throttle"
import { matchTotp } from "@/lib/totp"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/action"
import { loginSchema } from "@/lib/validators"

export async function login(raw: { password: string; code?: string }): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." }
  }
  // Counted before the password is evaluated, so the limit bounds guesses, not just feedback.
  const ip = await clientIp()
  if (!(await allowAll([[`admin-login:ip:${ip}`, 5, 15 * MINUTE], ["admin-login:all", 30, 15 * MINUTE]]))) {
    return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." }
  }
  const token = checkPassword(parsed.data.password)
  const totpSecret = process.env.ADMIN_TOTP_SECRET
  const step = totpSecret ? matchTotp(totpSecret, parsed.data.code ?? "") : 0
  // One message for either failure, so the password can't be confirmed without the code.
  if (!token || step === null) {
    return { ok: false, error: totpSecret ? "Wrong password or authenticator code." : "Wrong password." }
  }
  if (totpSecret && !(await claimTotpStep(step))) {
    return { ok: false, error: "That code was already used. Wait for the next one." }
  }
  await clearLimit(`admin-login:ip:${ip}`)

  ;(await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}

export async function logout(): Promise<ActionResult> {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  jar.delete(TEAM_COOKIE)
  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}

/** A TOTP code works once: remember the newest step used and refuse that step or older. */
async function claimTotpStep(step: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES ('admin-totp:last-step', ${step}, now())
    ON CONFLICT ("key") DO UPDATE SET "count" = ${step}, "windowStart" = now()
    WHERE "RateLimit"."count" < ${step}
    RETURNING "count"`
  return rows.length === 1
}
