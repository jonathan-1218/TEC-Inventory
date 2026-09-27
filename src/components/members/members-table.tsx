"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToneBadge } from "@/components/badges"
import { ConfirmDelete } from "@/components/confirm-delete"
import { useIsAdmin } from "@/components/admin-context"
import { ActiveBadge, DesignationBadge, designationRank } from "@/components/members/member-badges"
import { MemberFormDialog, type MemberFormValues } from "@/components/members/member-form-dialog"
import { deleteMember } from "@/app/actions/members"
import { DESIGNATIONS, DESIGNATION_LABELS } from "@/lib/labels"

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
  children,
}: {
  k: SortKey
  sort: Sort
  onSort: (sort: Sort) => void
  children: React.ReactNode
}) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
  return (
    <TableHead aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        className="hover:text-foreground inline-flex items-center gap-1"
        onClick={() => onSort({ key: k, dir: active && sort.dir === 1 ? -1 : 1 })}
      >
        {children}
        <Icon className={active ? "size-3.5" : "text-muted-foreground size-3.5"} />
      </button>
    </TableHead>
  )
}

function compare(a: MemberRow, b: MemberRow, key: SortKey): number {
  if (key === "designation") return designationRank(a.designation) - designationRank(b.designation)
  if (key === "yearOfStudy") return a.yearOfStudy - b.yearOfStudy
  return a[key].localeCompare(b[key])
}

export function MembersTable({ members, departments }: { members: MemberRow[]; departments: string[] }) {
  const admin = useIsAdmin()
  const [query, setQuery] = useState("")
  const [designation, setDesignation] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [year, setYear] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [sort, setSort] = useState<Sort>({ key: "designation", dir: 1 })

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
      .sort((a, b) => compare(a, b, sort.key) * sort.dir || a.name.localeCompare(b.name))
  }, [members, query, designation, department, year, status, sort])

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
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, roll no, email, phone…"
            aria-label="Search members"
            className="pl-8"
          />
        </div>
        <Select value={designation} onValueChange={setDesignation}>
          <SelectTrigger aria-label="Filter by designation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All designations</SelectItem>
            {DESIGNATIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {DESIGNATION_LABELS[d]}
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
        <p className="text-muted-foreground text-sm tabular-nums sm:ml-auto" aria-live="polite">
          {rows.length === members.length
            ? `${members.length} members`
            : `${rows.length} of ${members.length} members`}
        </p>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="name" sort={sort} onSort={setSort}>Name</SortHead>
              <SortHead k="rollNumber" sort={sort} onSort={setSort}>Roll no</SortHead>
              <SortHead k="department" sort={sort} onSort={setSort}>Department</SortHead>
              <SortHead k="yearOfStudy" sort={sort} onSort={setSort}>Year</SortHead>
              <SortHead k="designation" sort={sort} onSort={setSort}>Designation</SortHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden 2xl:table-cell">Phone</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell colSpan={admin ? 9 : 8} className="text-muted-foreground h-24 text-center">
                  No members match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id} className={m.isActive ? undefined : "text-muted-foreground"}>
                  <TableCell>
                    <Link href={`/members/${m.id}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    <p className="text-muted-foreground text-xs md:hidden">{m.email}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.rollNumber}</TableCell>
                  <TableCell className="min-w-32 whitespace-normal">{m.department}</TableCell>
                  <TableCell className="tabular-nums">{m.yearOfStudy}</TableCell>
                  <TableCell>
                    <DesignationBadge designation={m.designation} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <a href={`mailto:${m.email}`} className="hover:underline">
                      {m.email}
                    </a>
                  </TableCell>
                  <TableCell className="hidden tabular-nums 2xl:table-cell">
                    {m.phone ? (
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="hover:underline">
                        {m.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ActiveBadge active={m.isActive} />
                      {m.openIssuances > 0 && <ToneBadge tone="amber">Holding {m.openIssuances}</ToneBadge>}
                    </div>
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
      </Card>
    </div>
  )
}

function RowActions({ member, departments }: { member: MemberRow; departments: string[] }) {
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
