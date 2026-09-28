"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Eye,
  MoreHorizontal,
  PackageMinus,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsAdmin } from "@/components/admin-context"
import { CategoryBadge, StockBadge } from "@/components/badges"
import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState } from "@/components/empty-state"
import { IssueDialog } from "@/components/issue-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { OpenIssuancesDialog, type OpenIssuance } from "@/components/inventory/open-issuances-dialog"
import { StockMeter } from "@/components/inventory/stock-meter"
import { deleteComponent } from "@/app/actions/components"
import { CATEGORIES, CATEGORY_LABELS, type StockStatus } from "@/lib/labels"
import type { ComponentWithStock, SelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

export type { OpenIssuance }

type SortKey =
  | "name"
  | "category"
  | "location"
  | "quantityTotal"
  | "quantityDamaged"
  | "quantityUnderRepair"
  | "quantityIssued"
  | "quantityAvailable"
  | "stockStatus"

type Sort = { key: SortKey; dir: "asc" | "desc" }

const STATUS_RANK: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 }

/** Quick filter chips (one at a time; click again to clear). */
const CHIPS = [
  // Includes empty parts, like the dashboard's "N parts low on stock" (links here as ?stock=low).
  { value: "low", label: "Low stock", test: (c: ComponentWithStock) => c.stockStatus !== "ok" },
  { value: "out", label: "Out of stock", test: (c: ComponentWithStock) => c.stockStatus === "out" },
  { value: "issued", label: "Issued out", test: (c: ComponentWithStock) => c.quantityIssued > 0 },
] as const
type Chip = (typeof CHIPS)[number]["value"] | null

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: "name", label: "Part", className: "pl-4" },
  { key: "category", label: "Category", className: "hidden sm:table-cell" },
  { key: "location", label: "Location", className: "hidden lg:table-cell" },
  { key: "quantityTotal", label: "Total", numeric: true, className: "hidden md:table-cell" },
  { key: "quantityIssued", label: "Issued", numeric: true, className: "hidden sm:table-cell" },
  { key: "quantityDamaged", label: "Damaged", numeric: true, className: "hidden min-[1400px]:table-cell" },
  { key: "quantityUnderRepair", label: "Repair", numeric: true, className: "hidden min-[1400px]:table-cell" },
  { key: "quantityAvailable", label: "Available", numeric: true },
  { key: "stockStatus", label: "Status", className: "hidden sm:table-cell" },
]

function sortValue(c: ComponentWithStock, key: SortKey): string | number {
  if (key === "category") return CATEGORY_LABELS[c.category]
  if (key === "stockStatus") return STATUS_RANK[c.stockStatus]
  return c[key] ?? ""
}

/** Mono count; zeros recede so the non-zero readings stand out. */
function Num({ n, className }: { n: number; className?: string }) {
  return <span className={cn("font-mono tabular-nums", n === 0 && "text-muted-foreground", className)}>{n}</span>
}

export function InventoryTable({
  components,
  options,
  openIssuances,
  initialQuery,
  initialStock,
}: {
  components: ComponentWithStock[]
  options: SelectOptions
  /** componentId -> open issuances, for the quick-return dialog. */
  openIssuances: Record<string, OpenIssuance[]>
  initialQuery: string
  /** Quick filter from `?stock=low|out|issued`. */
  initialStock?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState("all")
  const [chip, setChip] = useState<Chip>(CHIPS.find((c) => c.value === initialStock)?.value ?? null)
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" })

  const chipCounts = useMemo(
    () => Object.fromEntries(CHIPS.map((c) => [c.value, components.filter(c.test).length])),
    [components]
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const chipTest = CHIPS.find((c) => c.value === chip)?.test
    return components
      .filter(
        (c) =>
          (category === "all" || c.category === category) &&
          (!chipTest || chipTest(c)) &&
          (!q || [c.name, c.modelNumber, c.location, c.description].some((f) => f?.toLowerCase().includes(q)))
      )
      .sort((a, b) => {
        const x = sortValue(a, sort.key)
        const y = sortValue(b, sort.key)
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
        return (sort.dir === "asc" ? r : -r) || a.name.localeCompare(b.name)
      })
  }, [components, query, category, chip, sort])

  const filtered = query !== "" || category !== "all" || chip !== null
  const clearFilters = () => {
    setQuery("")
    setCategory("all")
    setChip(null)
  }
  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))

  if (components.length === 0) {
    return (
      <EmptyState icon={Boxes} title="No components yet" description="Add the first item to start tracking stock.">
        <AddComponentButton />
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, model, location…"
            aria-label="Search components"
          />
        </InputGroup>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div role="group" aria-label="Filter by stock" className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => {
            const on = chip === c.value
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setChip(on ? null : c.value)}
                className={cn(
                  "ease-snap inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10",
                  on
                    ? "border-brand/60 bg-brand-soft text-brand-strong"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {c.label}
                <span className={cn("font-mono text-[11px] tabular-nums", !on && "text-muted-foreground")}>
                  {chipCounts[c.value]}
                </span>
              </button>
            )
          })}
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        )}
        <p className="eyebrow tabular-nums sm:ml-auto" aria-live="polite">
          {rows.length} / {components.length} parts
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching components" description="Try a different search or clear the filters.">
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key
                  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
                  return (
                    <TableHead
                      key={col.key}
                      className={cn(col.numeric && "text-right", col.className)}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "hover:text-foreground inline-flex items-center gap-1 uppercase",
                          col.numeric && "flex-row-reverse",
                          active && "text-foreground"
                        )}
                      >
                        {col.label}
                        <Icon className={cn("size-3", active ? "text-brand-strong" : "opacity-40")} aria-hidden />
                      </button>
                    </TableHead>
                  )
                })}
                <TableHead className="w-0 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className={cn(c.stockStatus === "out" && "bg-brand-soft/40 hover:bg-brand-soft/60")}>
                  <TableCell className="min-w-44 pl-4 whitespace-normal">
                    <Link href={`/inventory/${c.id}`} className="hover:text-brand-strong font-medium transition-colors">
                      {c.name}
                    </Link>
                    {c.modelNumber && (
                      <p className="text-muted-foreground font-mono text-[11px] tracking-wide">{c.modelNumber}</p>
                    )}
                    {c.stockStatus !== "ok" && (
                      <div className="mt-1 sm:hidden">
                        <StockBadge status={c.stockStatus} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden font-mono text-xs whitespace-normal lg:table-cell">
                    {c.location ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <Num n={c.quantityTotal} />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Num n={c.quantityIssued} className={cn(c.quantityIssued > 0 && "text-brand-strong")} />
                  </TableCell>
                  <TableCell className="hidden text-right min-[1400px]:table-cell">
                    <Num n={c.quantityDamaged} />
                  </TableCell>
                  <TableCell className="hidden text-right min-[1400px]:table-cell">
                    <Num n={c.quantityUnderRepair} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <StockMeter stock={c} className="hidden w-20 md:flex" />
                      <span className="min-w-12 font-mono tabular-nums">
                        <span className="text-foreground text-[15px] font-semibold">{c.quantityAvailable}</span>
                        <span className="text-muted-foreground text-xs">/{c.quantityTotal}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StockBadge status={c.stockStatus} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <RowActions component={c} options={options} issuances={openIssuances[c.id] ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function AddComponentButton() {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null
  return (
    <ComponentFormDialog
      trigger={
        <Button variant="brand">
          <Plus /> Add component
        </Button>
      }
    />
  )
}

type RowDialog = "edit" | "issue" | "return" | "delete" | null

function RowActions({
  component: c,
  options,
  issuances,
}: {
  component: ComponentWithStock
  options: SelectOptions
  issuances: OpenIssuance[]
}) {
  const isAdmin = useIsAdmin()
  // Dialogs live outside the menu (which unmounts on close), so their open state lives here.
  const [dialog, setDialog] = useState<RowDialog>(null)
  const openChange = (d: RowDialog) => (open: boolean) => setDialog(open ? d : null)

  if (!isAdmin) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/inventory/${c.id}`} aria-label={`View ${c.name}`}>
          View
        </Link>
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/inventory/${c.id}`}>
              <Eye /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={c.quantityAvailable <= 0} onSelect={() => setDialog("issue")}>
            <PackageMinus /> Issue…
          </DropdownMenuItem>
          {issuances.length > 0 && (
            <DropdownMenuItem onSelect={() => setDialog("return")}>
              <Undo2 /> Return…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={openChange("delete")}
        title={`Delete ${c.name}?`}
        description={
          c.quantityIssued > 0
            ? `${c.quantityIssued} unit(s) are still issued on ${issuances.length} open issuance(s). Return them first — deleting will be refused until then.`
            : "This permanently removes the component, its issuance history and project requirements."
        }
        successMessage="Component deleted"
        onConfirm={() => deleteComponent({ id: c.id })}
      />

      <ComponentFormDialog
        component={c}
        issued={c.quantityIssued}
        open={dialog === "edit"}
        onOpenChange={openChange("edit")}
      />
      <IssueDialog
        options={options}
        componentId={c.id}
        open={dialog === "issue"}
        onOpenChange={openChange("issue")}
      />
      <OpenIssuancesDialog
        componentName={c.name}
        issuances={issuances}
        open={dialog === "return"}
        onOpenChange={openChange("return")}
      />
    </>
  )
}
