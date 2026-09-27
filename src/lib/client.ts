import { toast } from "sonner"
import type { ActionResult } from "@/lib/action"

/** Await a server action, toast the outcome, and return the result. */
export async function runAction<T>(
  promise: Promise<ActionResult<T>>,
  successMessage?: string
): Promise<ActionResult<T>> {
  try {
    const res = await promise
    if (res.ok) {
      if (successMessage) toast.success(successMessage)
    } else {
      toast.error(res.error)
    }
    return res
  } catch (e) {
    // Actions called with `redirectTo` reject with Next's redirect signal after succeeding;
    // the router has already navigated, so treat it as success.
    if (isRedirect(e)) {
      if (successMessage) toast.success(successMessage)
      return { ok: true, data: undefined as T }
    }
    toast.error("Couldn't reach the server. Please try again.")
    return { ok: false, error: "Network error" }
  }
}

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
}

/** FormData -> plain object of strings (unchecked checkboxes are simply absent). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])
  )
}
