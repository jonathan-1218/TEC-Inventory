"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ToggleGroup } from "radix-ui"
import { cn } from "cn"
import { RANGES } from "./shared"

/**
 * Segmented 7d / 30d / 90d control.
 * - Local state: `<RangeToggle value={range} onValueChange={setRange} />`
 * - URL (server re-renders): `<RangeToggle value={range} param="range" />` — writes `?range=` with router.replace,
 *   keeping other params; the page reads it with `parseRange((await searchParams).range)`.
 */
export function RangeToggle({
  value,
  onValueChange,
  param,
  options = RANGES,
  label = "Time range",
  className,
}: {
  value: string
  onValueChange?: (value: string) => void
  /** Search param to sync with (URL mode). */
  param?: string
  options?: readonly string[]
  label?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = React.useTransition()
  const [optimistic, setOptimistic] = React.useOptimistic(value)

  const change = (next: string) => {
    if (!next || next === optimistic) return // Radix sends "" when the active item is clicked again.
    onValueChange?.(next)
    if (param) {
      startTransition(() => {
        setOptimistic(next)
        // Read the live URL at click time, so no useSearchParams (and no Suspense boundary) is needed.
        const params = new URLSearchParams(window.location.search)
        params.set(param, next)
        router.replace(`${pathname}?${params}`, { scroll: false })
      })
    }
  }

  return (
    <ToggleGroup.Root
      type="single"
      value={optimistic}
      onValueChange={change}
      aria-label={label}
      data-pending={pending || undefined}
      className={cn(
        "inline-flex h-8 items-center max-sm:h-11 rounded-md border border-border bg-muted/50 p-0.5 font-mono text-[11px] data-pending:[&_[data-state=on]]:animate-pulse",
        className
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o}
          value={o}
          className="group relative h-full min-w-10 rounded-[5px] px-2.5 tracking-wider text-muted-foreground uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm max-sm:min-w-12"
        >
          {o}
          <span aria-hidden className="absolute inset-x-2.5 bottom-0.5 hidden h-0.5 rounded-full bg-[var(--chart-1,#E99704)] group-data-[state=on]:block" />
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
