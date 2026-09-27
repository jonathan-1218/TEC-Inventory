import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { AddComponentButton, InventoryTable, type OpenIssuance } from "@/components/inventory/inventory-table"
import { db } from "@/lib/db"
import { getComponentsWithStock, getSelectOptions } from "@/lib/queries"

export const metadata: Metadata = { title: "Inventory" }

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const { q } = await props.searchParams
  const query = typeof q === "string" ? q.slice(0, 100) : ""

  const [components, options, open] = await Promise.all([
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
  ])

  const openIssuances: Record<string, OpenIssuance[]> = {}
  for (const { componentId, issuedTo, ...i } of open) {
    ;(openIssuances[componentId] ??= []).push({ ...i, member: issuedTo })
  }

  const units = components.reduce((n, c) => n + c.quantityTotal, 0)
  const issued = components.reduce((n, c) => n + c.quantityIssued, 0)

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Inventory"
        description={`${components.length} components · ${units} units · ${issued} issued`}
      >
        <AddComponentButton />
      </PageHeader>
      {/* Keyed by ?q= so a new search from the header resets the filters. */}
      <InventoryTable
        key={query}
        components={components}
        options={options}
        openIssuances={openIssuances}
        initialQuery={query}
      />
    </div>
  )
}
