"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_COOKIE, checkPassword } from "@/lib/auth"
import type { ActionResult } from "@/lib/action"
import { loginSchema } from "@/lib/validators"

export async function login(raw: { password: string }): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." }
  }
  const token = checkPassword(parsed.data.password)
  if (!token) return { ok: false, error: "Wrong password." }

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
