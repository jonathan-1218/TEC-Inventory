"use client"

import { useState } from "react"
import { RangeToggle, TrendChart } from "@/components/charts"
import { formatDay, parseRange, type Range } from "@/components/charts/shared"
import type { CheckoutPoint } from "@/lib/analytics"
import { Panel } from "./panel"

const SERIES = [
  { key: "issued", label: "Issued" },
  { key: "returned", label: "Returned" },
]

/**
 * Issued vs returned per day. Gets 90 days once and slices on the client, so switching range is instant;
 * the choice is mirrored into `?range=` (replaceState, no server round trip) so the view can be shared.
 */
export function CheckoutPanel({ data, initialRange, i, className }: { data: CheckoutPoint[]; initialRange: Range; i: number; className?: string }) {
  const [range, setRange] = useState<string>(initialRange)
  const { days } = parseRange(range)
  const rows = data.slice(-days)

  const change = (next: string) => {
    setRange(next)
    const params = new URLSearchParams(window.location.search)
    params.set("range", next)
    window.history.replaceState(null, "", `?${params}`)
  }

  return (
    <Panel
      i={i}
      className={className}
      eyebrow={`Checkouts · last ${days} days`}
      title="Parts out vs parts back"
      description={summary(rows)}
      action={<RangeToggle value={range} onValueChange={change} label="Checkout chart range" />}
      // Phones: the toggle drops under the text instead of squeezing it.
      actionClassName="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-auto max-sm:mt-2 max-sm:justify-self-start"
    >
      <TrendChart data={rows} series={SERIES} height={330} emptyMessage="No checkouts in this range" />
    </Panel>
  )
}

function summary(rows: CheckoutPoint[]): string {
  if (!rows.length) return "No checkouts recorded yet."
  const first = rows[0]
  const last = rows[rows.length - 1]
  const peak = rows.reduce((best, r) => (r.issued > best.issued ? r : best), first)
  // Units on loan at the start of the range = end of the first day minus that day's own movement.
  const net = last.onLoan - (first.onLoan - first.issued + first.returned)
  const trend = net === 0 ? "the same as" : `${Math.abs(net)} ${net > 0 ? "more than" : "fewer than"}`
  return (
    `${last.onLoan} units on loan now, ${trend} ${rows.length} days ago.` +
    (peak.issued ? ` Busiest day: ${formatDay(peak.date)}, with ${peak.issued} out.` : "")
  )
}
