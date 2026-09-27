"use server"

import { searchAll, type SearchResult } from "@/lib/queries"

/** Read-only; no login needed. */
export async function search(query: string): Promise<SearchResult[]> {
  if (typeof query !== "string" || query.length > 100) return []
  return searchAll(query, 5)
}
