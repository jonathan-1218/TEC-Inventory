"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_COOKIE, checkPassword } from "@/lib/auth"
import type { ActionResult } from "@/lib/action"
import { loginSchema } from "@/lib/validators"

// ponytail: global fixed-window login throttle to kill online brute force. One in-process counter —
// this app runs single-instance; move to a shared store (Redis/Postgres) if it ever scales out.
// Global, not per-IP: x-forwarded-for is client-spoofable on this deploy (no trusted proxy), so a
// per-IP cap would be bypassed by rotating the header. Cap is checked before checkPassword, so it
// bounds guess *evaluation*, not just feedback. The only cost: during an active guessing burst a
// legit admin may wait out the <=60s window — fine for a single-admin tool, vs. unlimited guessing.
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 20
let windowStart = 0
let attempts = 0

export async function login(raw: { password: string }): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." }
  }
  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    windowStart = now
    attempts = 0
  }
  attempts++
  if (attempts > MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." }
  }
  const token = checkPassword(parsed.data.password)
  if (!token) return { ok: false, error: "Wrong password." }
  attempts = 0 // legit login clears the window

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
  ;(await cookies()).delete(ADMIN_COOKIE)
  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}
