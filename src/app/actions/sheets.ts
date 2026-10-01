"use server"

import { isAdmin } from "@/lib/auth"
import type { ActionResult } from "@/lib/action"
import { syncComponentsToSheet } from "@/lib/sheets"

/** Admin "Sync to Sheets": rewrite the Google Sheet now and report the outcome (automatic syncs are silent). */
export async function syncSheetNow(): Promise<ActionResult<{ rows: number; url: string }>> {
  if (!(await isAdmin())) return { ok: false, error: "Admin login required to make changes." }
  try {
    const result = await syncComponentsToSheet()
    if (!result) return { ok: false, error: "Google Sheets isn't set up — add GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY." }
    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Google Sheets sync failed." }
  }
}
