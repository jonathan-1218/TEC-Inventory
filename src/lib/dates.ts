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

// Month and weekday names are spelled out here instead of coming from Intl: Node and Chrome disagree on them
// ("Sep" vs "Sept" for en-IN), and any difference between the server's and the browser's text breaks hydration.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Calendar year / month (1–12) / day / weekday (0 = Sunday) of `date` in `timeZone`. */
export function dayParts(date: Date | string, timeZone = "UTC") {
  const [y, m, d] = new Date(date).toLocaleDateString("en-CA", { timeZone }).split("-").map(Number)
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

/** "12 Sep", "12 Sep 2026" or "Sat, 12 Sep 2026". */
export function dayLabel(date: Date | string, timeZone = "UTC", o: { weekday?: boolean; year?: boolean } = {}): string {
  const p = dayParts(date, timeZone)
  const core = `${p.d} ${MONTHS_SHORT[p.m - 1]}${o.year ? ` ${p.y}` : ""}`
  return o.weekday ? `${WEEKDAYS_SHORT[p.wd]}, ${core}` : core
}

export const monthShort = (date: Date | string, timeZone = "UTC") => MONTHS_SHORT[dayParts(date, timeZone).m - 1]

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return dayLabel(date, "UTC", { year: true })
}

/** For real timestamps (createdAt/updatedAt), shown in the club's time zone. */
export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return dayLabel(date, APP_TIME_ZONE, { year: true })
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
