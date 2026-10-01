import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { isAdmin } from "@/lib/auth"
import { ActionError } from "@/lib/action-error"
import { safePath } from "@/lib/safe-path"
import { scheduleSheetSync } from "@/lib/sheets"

export { ActionError }

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

/**
 * Wraps a server action: requires admin, validates input with zod, maps known
 * errors to messages, and revalidates every page on success.
 */
export function adminAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>) => Promise<T>
) {
  // Accepts typed input or raw string form values; zod validates both.
  // Optional `redirectTo` (same-site path) navigates after success in the same round trip,
  // e.g. deleting from a detail page without it re-rendering as a 404 first.
  return async (
    raw: (z.input<S> | Record<string, string>) & { redirectTo?: string }
  ): Promise<ActionResult<T>> => {
    if (!(await isAdmin())) return { ok: false, error: "Admin login required to make changes." }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path.join(".")
      const fieldErrors: Record<string, string[]> = {}
      for (const i of parsed.error.issues) {
        const key = i.path.join(".") || "_form"
        ;(fieldErrors[key] ??= []).push(i.message)
      }
      return {
        ok: false,
        error: field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid input"),
        fieldErrors,
      }
    }

    let data: T
    try {
      data = await handler(parsed.data)
      revalidatePath("/", "layout")
      scheduleSheetSync() // mirror the inventory to Google Sheets after the response (no-op if not configured)
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
    // Same-site only (safePath blocks protocol-relative and control-char bypasses). Only redirect
    // when a target was actually supplied, so safePath's "/" fallback doesn't force a spurious nav.
    if (typeof raw.redirectTo === "string" && raw.redirectTo !== "") {
      const to = safePath(raw.redirectTo)
      if (to !== "/") redirect(to) // throws; must be outside try
    }
    return { ok: true, data }
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ActionError) return e.message
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = (e.meta?.target as string[] | string | undefined) ?? "field"
      return `A record with this ${Array.isArray(target) ? target.join(", ") : target} already exists.`
    }
    if (e.code === "P2025") return "Record not found — it may have been deleted."
    if (e.code === "P2003") return "This record is referenced by other data."
    if (e.code === "P2034") return "Someone else changed this at the same time — please retry."
  }
  console.error(e)
  return "Something went wrong. Please try again."
}
