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
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { CategoryBadge, IssuanceStatusBadge, StockBadge } from "@/components/badges"
import { ConfirmDelete } from "@/components/confirm-delete"
import { EmptyState } from "@/components/empty-state"
import { IssueDialog } from "@/components/issue-dialog"
import { ReturnDialog } from "@/components/return-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { deleteComponent } from "@/app/actions/components"
import { daysOverdue, formatDate } from "@/lib/dates"
import { CATEGORIES, CATEGORY_LABELS, type StockStatus } from "@/lib/labels"
import type { ComponentWithStock, SelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

export type OpenIssuance = {
  id: string
  quantity: number
  expectedReturnDate: Date | null
  member: { id: string; name: string }
}

type SortKey =
  | "name"
  | "category"
  | "location"
  | "quantityTotal"
  | "quantityWorking"
  | "quantityDamaged"
  | "quantityUnderRepair"
  | "quantityIssued"
  | "quantityAvailable"
  | "stockStatus"

type Sort = { key: SortKey; dir: "asc" | "desc" }

const STATUS_RANK: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 }

const STOCK_FILTERS = [
  { value: "all", label: "All stock" },
  { value: "ok", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
] as const

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: "name", label: "Name", className: "pl-4" },
  { key: "category", label: "Category" },
  { key: "location", label: "Location", className: "hidden md:table-cell" },
  { key: "quantityTotal", label: "Total", numeric: true },
  // Working = issued + available, so it only earns its column on wide screens.
  { key: "quantityWorking", label: "Working", numeric: true, className: "hidden 2xl:table-cell" },
  { key: "quantityDamaged", label: "Damaged", numeric: true, className: "hidden md:table-cell" },
  { key: "quantityUnderRepair", label: "Under repair", numeric: true, className: "hidden md:table-cell" },
  { key: "quantityIssued", label: "Issued", numeric: true },
  { key: "quantityAvailable", label: "Available", numeric: true },
  { key: "stockStatus", label: "Status" },
]

function sortValue(c: ComponentWithStock, key: SortKey): string | number {
  if (key === "category") return CATEGORY_LABELS[c.category]
  if (key === "stockStatus") return STATUS_RANK[c.stockStatus]
  return c[key] ?? ""
}

export function InventoryTable({
  components,
  options,
  openIssuances,
  initialQuery,
}: {
  components: ComponentWithStock[]
  options: SelectOptions
  /** componentId -> open issuances, for the quick-return dialog. */
  openIssuances: Record<string, OpenIssuance[]>
  initialQuery: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState("all")
  const [stock, setStock] = useState("all")
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return components
      .filter(
        (c) =>
          (category === "all" || c.category === category) &&
          (stock === "all" || c.stockStatus === stock) &&
          (!q || [c.name, c.modelNumber, c.location, c.description].some((f) => f?.toLowerCase().includes(q)))
      )
      .sort((a, b) => {
        const x = sortValue(a, sort.key)
        const y = sortValue(b, sort.key)
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
        return (sort.dir === "asc" ? r : -r) || a.name.localeCompare(b.name)
      })
  }, [components, query, category, stock, sort])

  const filtered = query !== "" || category !== "all" || stock !== "all"
  const clearFilters = () => {
    setQuery("")
    setCategory("all")
    setStock("all")
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
    <div className="grid gap-4">
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
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by stock status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STOCK_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        )}
        <p className="text-muted-foreground text-sm tabular-nums sm:ml-auto" aria-live="polite">
          {rows.length} of {components.length} components
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching components" description="Try a different search or clear the filters.">
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <Card className="py-0">
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
                          "hover:text-foreground inline-flex items-center gap-1",
                          col.numeric && "flex-row-reverse",
                          !active && "text-muted-foreground"
                        )}
                      >
                        {col.label}
                        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
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
                <TableRow key={c.id} className={cn(c.stockStatus === "out" && "bg-red-500/5")}>
                  <TableCell className="min-w-40 pl-4 whitespace-normal">
                    <Link href={`/inventory/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {c.modelNumber && <p className="text-muted-foreground text-xs">{c.modelNumber}</p>}
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden whitespace-normal md:table-cell">{c.location ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.quantityTotal}</TableCell>
                  <TableCell className="hidden text-right tabular-nums 2xl:table-cell">{c.quantityWorking}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{c.quantityDamaged}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{c.quantityUnderRepair}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.quantityIssued}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{c.quantityAvailable}</TableCell>
                  <TableCell>
                    <StockBadge status={c.stockStatus} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <RowActions component={c} options={options} issuances={openIssuances[c.id] ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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
        <Button>
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
        <Link href={`/inventory/${c.id}`}>View</Link>
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

/** Lists a component's open issuances, each with its own return flow. */
function OpenIssuancesDialog({
  componentName,
  issuances,
  open,
  onOpenChange,
}: {
  componentName: string
  issuances: OpenIssuance[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return {componentName}</DialogTitle>
          <DialogDescription>Choose the checkout being returned.</DialogDescription>
        </DialogHeader>
        {issuances.length === 0 ? (
          <p className="text-muted-foreground text-sm">All units are back in stock.</p>
        ) : (
          <ul className="divide-y">
            {issuances.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/members/${i.member.id}`} className="block truncate font-medium hover:underline">
                    {i.member.name}
                  </Link>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {i.quantity} unit(s) ·{" "}
                    {i.expectedReturnDate ? `due ${formatDate(i.expectedReturnDate)}` : "no due date"}
                  </p>
                </div>
                <IssuanceStatusBadge
                  returned={false}
                  overdueDays={i.expectedReturnDate ? daysOverdue(i.expectedReturnDate) : 0}
                />
                <ReturnDialog
                  issuance={{ id: i.id, quantity: i.quantity, componentName, memberName: i.member.name }}
                  trigger={
                    <Button size="sm" variant="outline">
                      Return
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
