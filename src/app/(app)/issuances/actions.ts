"use server"

import { isAdmin } from "@/lib/auth"
import { getSelectOptions } from "@/lib/queries"

/** Select options for the ⌘K "Issue component" action. Admin only (lists member names and register numbers). */
export async function issueOptions() {
  return (await isAdmin()) ? getSelectOptions() : null
}
