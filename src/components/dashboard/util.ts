// Small wording helpers shared by the dashboard panels (server and client safe).
import { parseDateInput } from "@/lib/dates"

/** plural(3, "return") -> "3 returns"; plural(1, "part") -> "1 part". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

/** Days from today (0 today, <0 past) -> "today", "tomorrow", "yesterday", "in 3d", "3d ago". */
export function relDays(days: number): string {
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days}d` : `${-days}d ago`
}

const DAY = 86_400_000
const time = (d: Date | string) => (typeof d === "string" ? parseDateInput(d) : d).getTime()
/** Whole days from `from` to `to` (calendar dates stored at 12:00 UTC, or "YYYY-MM-DD"). */
export const daysBetween = (from: Date | string, to: Date | string) => Math.round((time(to) - time(from)) / DAY)
