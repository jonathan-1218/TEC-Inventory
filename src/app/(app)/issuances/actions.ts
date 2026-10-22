"use server"

import { isAdmin } from "@/lib/auth"
import { getSelectOptions } from "@/lib/queries"

/** Select options for the ⌘K "Issue component" action. Admin only (lists member names and roll numbers). */
export async function issueOptions() {
  return (await isAdmin()) ? getSelectOptions() : null
}
