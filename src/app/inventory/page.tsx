import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminOnly } from "@/components/admin-context"
import { StockBadge } from "@/components/badges"
import { StackedBars } from "@/components/charts"
import { PageHeader } from "@/components/page-header"
import { AddComponentButton, InventoryTable, type OpenIssuance } from "@/components/inventory/inventory-table"
import { StockMeter } from "@/components/inventory/stock-meter"
import { getInventoryHealth } from "@/lib/analytics"
import { db } from "@/lib/db"
import { getComponentsWithStock, getSelectOptions } from "@/lib/queries"

export const metadata: Metadata = { title: "Inventory" }

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const { q, stock } = await props.searchParams
  const query = typeof q === "string" ? q.slice(0, 100) : ""
  const stockFilter = typeof stock === "string" ? stock : undefined

  const [components, options, open, health] = await Promise.all([
    getComponentsWithStock(),
    getSelectOptions(),
    db.issuance.findMany({
      where: { returnedDate: null },
      select: {
        id: true,
        componentId: true,
        quantity: true,
        expectedReturnDate: true,
        issuedTo: { select: { id: true, name: true } },
      },
      orderBy: { issuedDate: "asc" },
    }),
    getInventoryHealth(),
  ])

  const openIssuances: Record<string, OpenIssuance[]> = {}
  for (const { componentId, issuedTo, ...i } of open) {
    ;(openIssuances[componentId] ??= []).push({ ...i, member: issuedTo })
  }

  const units = components.reduce((n, c) => n + c.quantityTotal, 0)
  const issued = components.reduce((n, c) => n + c.quantityIssued, 0)
  const available = components.reduce((n, c) => n + c.quantityAvailable, 0)
  const low = components
    .filter((c) => c.stockStatus !== "ok")
    .sort((a, b) => a.quantityAvailable - b.quantityAvailable || a.name.localeCompare(b.name))

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="Stock · Parts list"
        title="Inventory"
        description={
          <span className="font-mono text-xs tabular-nums">
            {components.length} parts · {units} units · {available} available · {issued} on loan
          </span>
        }
      >
        <AdminOnly>
          <Button variant="outline" asChild>
            <a href="/api/export/components" download>
              <Download /> Export CSV
            </a>
          </Button>
        </AdminOnly>
        <AddComponentButton />
      </PageHeader>

      {components.length > 0 && (
        // On phones the parts list comes first; the overview follows it.
        <div className="order-last grid gap-4 lg:order-none lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <p className="eyebrow">Stock by category</p>
              <CardTitle>Where the units are</CardTitle>
              <CardDescription>Available, on loan, damaged and under repair, per category.</CardDescription>
            </CardHeader>
            <CardContent>
              <StackedBars
                data={health.map((h) => ({
                  label: h.label,
                  available: h.available,
                  issued: h.issued,
                  damaged: h.damaged,
                  underRepair: h.underRepair,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="eyebrow">Watchlist</p>
              <CardTitle>Running low</CardTitle>
              <CardDescription>
                {low.length === 0 ? "Every part is above its low-stock level." : "Available vs. the low-stock level (tick)."}
              </CardDescription>
            </CardHeader>
            {low.length > 0 && (
              <CardContent>
                <ul className="grid gap-3.5">
                  {low.map((c) => (
                    <li key={c.id} className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/inventory/${c.id}`}
                          className="hover:text-brand-strong min-w-0 truncate text-sm font-medium transition-colors"
                        >
                          {c.name}
                        </Link>
                        <span className="shrink-0 font-mono text-xs tabular-nums">
                          <span className="text-foreground font-semibold">{c.quantityAvailable}</span>
                          <span className="text-muted-foreground"> / low ≤ {c.lowStockThreshold}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StockMeter stock={c} threshold={c.lowStockThreshold} className="flex-1" />
                        <StockBadge status={c.stockStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Keyed by ?q= / ?stock= so a new search or deep link resets the filters. */}
      <InventoryTable
        key={`${query}|${stockFilter ?? ""}`}
        initialStock={stockFilter}
        components={components}
        options={options}
        openIssuances={openIssuances}
        initialQuery={query}
      />
    </div>
  )
}
