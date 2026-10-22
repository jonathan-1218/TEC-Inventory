"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, LayoutGrid, List, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react"
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
import { ConfirmDelete } from "@/components/confirm-delete"
import { useIsAdmin } from "@/components/admin-context"
import { ActiveBadge, DesignationBadge, MemberAvatar } from "@/components/members/member-badges"
import { MembersCards } from "@/components/members/members-cards"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MemberFormDialog, type MemberFormValues } from "@/components/members/member-form-dialog"
import { deleteMember } from "@/app/actions/members"
import { useDesignations } from "@/components/designations-context"
import { cn } from "@/lib/utils"

export type MemberRow = MemberFormValues & {
  teamCount: number
  projectCount: number
  openIssuances: number
}

type SortKey = "designation" | "name" | "rollNumber" | "department" | "yearOfStudy"
type Sort = { key: SortKey; dir: 1 | -1 }

const ALL = "all"

function SortHead({
  k,
  sort,
  onSort,
  className,
  children,
}: {
  k: SortKey
  sort: Sort
  onSort: (sort: Sort) => void
  className?: string
  children: React.ReactNode
}) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        className={cn("hover:text-foreground inline-flex items-center gap-1 uppercase", active && "text-foreground")}
        onClick={() => onSort({ key: k, dir: active && sort.dir === 1 ? -1 : 1 })}
      >
        {children}
        <Icon className={cn("size-3", active ? "text-brand-strong" : "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  )
}

function compare(a: MemberRow, b: MemberRow, key: SortKey, rank: (id: string) => number): number {
  if (key === "designation") return rank(a.designation) - rank(b.designation)
  if (key === "yearOfStudy") return a.yearOfStudy - b.yearOfStudy
  return a[key].localeCompare(b[key])
}

export function MembersTable({ members, departments }: { members: MemberRow[]; departments: string[] }) {
  const admin = useIsAdmin()
  const roles = useDesignations()
  const [query, setQuery] = useState("")
  const [designation, setDesignation] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [year, setYear] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [sort, setSort] = useState<Sort>({ key: "designation", dir: 1 })
  const [view, setView] = useState<"cards" | "table">("cards")

  const years = useMemo(() => [...new Set(members.map((m) => m.yearOfStudy))].sort((a, b) => a - b), [members])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter(
        (m) =>
          (!q ||
            [m.name, m.rollNumber, m.email, m.phone, m.phone?.replace(/\s/g, "")].some((f) =>
              f?.toLowerCase().includes(q)
            )) &&
          (designation === ALL || m.designation === designation) &&
          (department === ALL || m.department === department) &&
          (year === ALL || String(m.yearOfStudy) === year) &&
          (status === ALL || m.isActive === (status === "active"))
      )
      .sort((a, b) => compare(a, b, sort.key, roles.rank) * sort.dir || a.name.localeCompare(b.name))
  }, [members, query, designation, department, year, status, sort, roles])

  const filtered = query !== "" || [designation, department, year, status].some((v) => v !== ALL)

  function clearFilters() {
    setQuery("")
    setDesignation(ALL)
    setDepartment(ALL)
    setYear(ALL)
    setStatus(ALL)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, roll no, email, phone…"
            aria-label="Search members"
          />
        </InputGroup>
        <Select value={designation} onValueChange={setDesignation}>
          <SelectTrigger aria-label="Filter by designation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All designations</SelectItem>
            {roles.list.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger aria-label="Filter by department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger aria-label="Filter by year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                Year {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        )}
        <p className="eyebrow tabular-nums sm:ml-auto" aria-live="polite">
          {rows.length} / {members.length} members
        </p>
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "cards" | "table")} aria-label="View">
          <ToggleGroupItem value="cards" aria-label="Cards">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "cards" ? (
        <MembersCards members={rows} departments={departments} admin={admin} />
      ) : (

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table className="[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHead k="name" sort={sort} onSort={setSort}>Name</SortHead>
              <SortHead k="rollNumber" sort={sort} onSort={setSort} className="hidden sm:table-cell">Roll no</SortHead>
              <SortHead k="department" sort={sort} onSort={setSort} className="hidden md:table-cell">Department</SortHead>
              <SortHead k="yearOfStudy" sort={sort} onSort={setSort} className="hidden sm:table-cell">Year</SortHead>
              <SortHead k="designation" sort={sort} onSort={setSort}>Designation</SortHead>
              <TableHead className="hidden xl:table-cell">Email</TableHead>
              <TableHead className="hidden 2xl:table-cell">Phone</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Holding</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              {admin && (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={admin ? 10 : 9} className="text-muted-foreground h-24 text-center">
                  No members match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id} className={m.isActive ? undefined : "text-muted-foreground"}>
                  <TableCell className="min-w-44">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar name={m.name} className={cn(!m.isActive && "opacity-60")} />
                      <div className="min-w-0">
                        <Link href={`/members/${m.id}`} className="hover:text-brand-strong font-medium transition-colors">
                          {m.name}
                        </Link>
                        <p className="text-muted-foreground font-mono text-[11px] sm:hidden">{m.rollNumber}</p>
                        <p className="text-muted-foreground hidden truncate text-xs sm:block xl:hidden">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{m.rollNumber}</TableCell>
                  <TableCell className="hidden min-w-32 whitespace-normal md:table-cell">{m.department}</TableCell>
                  <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">Y{m.yearOfStudy}</TableCell>
                  <TableCell>
                    <DesignationBadge label={roles.label(m.designation)} tier={roles.tier(m.designation)} />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {m.email ? (
                      <a href={`mailto:${m.email}`} className="hover:text-foreground text-muted-foreground">
                        {m.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs tabular-nums 2xl:table-cell">
                    {m.phone ? (
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="hover:text-foreground">
                        {m.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {m.openIssuances > 0 ? (
                      <span className="text-brand-strong inline-flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums">
                        <span aria-hidden className="bg-brand size-1.5 rounded-full" />
                        {m.openIssuances} out
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ActiveBadge active={m.isActive} />
                  </TableCell>
                  {admin && (
                    <TableCell>
                      <RowActions member={m} departments={departments} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  )
}

export function RowActions({ member, departments }: { member: MemberRow; departments: string[] }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roles = member.teamCount + member.projectCount

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link href={`/members/${member.id}`}>
              <Eye /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MemberFormDialog member={member} departments={departments} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${member.name}?`}
        description={
          member.openIssuances > 0
            ? `${member.name} still holds ${member.openIssuances} open issuance(s), so they can't be deleted. Record the returns first, or edit the member and mark them inactive instead.`
            : `This permanently removes ${member.name}, their issuance history${roles ? ` and ${roles} team/project role(s)` : ""}. To keep their history, mark them inactive instead.`
        }
        successMessage="Member deleted"
        onConfirm={() => deleteMember({ id: member.id })}
      />
    </>
  )
}
