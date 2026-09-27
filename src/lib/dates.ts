// Calendar dates (issued/expected/returned/start/target/update dates) are stored at 12:00 UTC
// so the same YYYY-MM-DD shows in every timezone from UTC-12 to UTC+12.

// ponytail: the club's time zone, used for "today" and for real timestamps (createdAt/updatedAt).
// Change it here if the club isn't in India.
export const APP_TIME_ZONE = "Asia/Kolkata"

/** "2026-09-25" -> Date at 2026-09-25T12:00:00Z */
export function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}

/** Date -> "YYYY-MM-DD" for <input type="date"> */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().slice(0, 10)
}

/** Today's local calendar date, stored the same way as other calendar dates. */
export function todayNoonUTC(): Date {
  return parseDateInput(new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** For real timestamps (createdAt/updatedAt), shown in the club's time zone. */
export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  })
}

/** The club-local calendar day of a timestamp, stored like other calendar dates (for sorting with them). */
export function calendarDay(date: Date | string): Date {
  return parseDateInput(new Date(date).toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }))
}

export function isOverdue(issuance: {
  returnedDate: Date | string | null
  expectedReturnDate: Date | string | null
}): boolean {
  if (issuance.returnedDate || !issuance.expectedReturnDate) return false
  return new Date(issuance.expectedReturnDate) < todayNoonUTC()
}

/** Whole days between an expected return date and today (positive = late). */
export function daysOverdue(expected: Date | string): number {
  return Math.round((todayNoonUTC().getTime() - new Date(expected).getTime()) / 86_400_000)
}
