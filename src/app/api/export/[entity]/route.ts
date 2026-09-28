import { isAdmin } from "@/lib/auth"
import { toDateInput, todayNoonUTC } from "@/lib/dates"
import { EXPORTS, toCsv } from "./csv"

/** GET /api/export/{components|issuances|members|projects|tasks} -> CSV download. Admin only: it includes members' emails and phones. */
export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  if (!(await isAdmin())) return new Response("Admin login required.", { status: 401 })
  const { entity } = await params
  if (!Object.hasOwn(EXPORTS, entity)) return new Response("Unknown export.", { status: 404 })

  const { headers, rows } = await EXPORTS[entity]()
  // BOM so Excel reads UTF-8 (°, ², –) correctly.
  return new Response("﻿" + toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tec-${entity}-${toDateInput(todayNoonUTC())}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
