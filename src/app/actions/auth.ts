"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_COOKIE, checkPassword } from "@/lib/auth"
import { TEAM_COOKIE } from "@/lib/team-auth"
import { fixedWindow } from "@/lib/throttle"
import type { ActionResult } from "@/lib/action"
import { loginSchema } from "@/lib/validators"

// Global login throttle against online brute force: the admin can wait out a 60 s window during a burst.
const throttle = fixedWindow(20)

export async function login(raw: { password: string }): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." }
  }
  if (!throttle.take()) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." }
  }
  const token = checkPassword(parsed.data.password)
  if (!token) return { ok: false, error: "Wrong password." }
  throttle.reset() // legit login clears the window

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
