import { cache } from "react"
import type { Component } from "@prisma/client"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { issuedCount, issuedCounts } from "@/lib/stock"
import { stockStatus, type StockStatus } from "@/lib/labels"

export type ComponentWithStock = Component & {
  quantityIssued: number
  quantityAvailable: number
  stockStatus: StockStatus
}

export function withStock(c: Component, issued: number): ComponentWithStock {
  const quantityAvailable = Math.max(0, c.quantityWorking - issued)
  return {
    ...c,
    quantityIssued: issued,
    quantityAvailable,
    stockStatus: stockStatus(quantityAvailable, c.lowStockThreshold),
  }
}

/**
 * All components with derived issued/available counts, sorted by name.
 * Memoised per request (dashboard panels share it) — copy before sorting in place.
 */
export const getComponentsWithStock = cache(async (): Promise<ComponentWithStock[]> => {
  const [components, issued] = await Promise.all([
    db.component.findMany({ orderBy: { name: "asc" } }),
    issuedCounts(db),
  ])
  return components.map((c) => withStock(c, issued.get(c.id) ?? 0))
})

export async function getComponentWithStock(id: string): Promise<ComponentWithStock | null> {
  // One round trip, and only this component's open issuances.
  const [c, issued] = await Promise.all([db.component.findUnique({ where: { id } }), issuedCount(db, id)])
  return c && withStock(c, issued)
}

/** Lightweight option lists for select inputs in issue / assign dialogs. */
export async function getSelectOptions() {
  const [members, projects, components] = await Promise.all([
    db.member.findMany({
      where: { isActive: true },
      select: { id: true, name: true, rollNumber: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { status: { notIn: ["COMPLETED", "DROPPED"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    getComponentsWithStock(),
  ])
  return {
    members,
    projects,
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      modelNumber: c.modelNumber,
      quantityAvailable: c.quantityAvailable,
    })),
  }
}

export type SelectOptions = Awaited<ReturnType<typeof getSelectOptions>>

export type SearchResult = {
  type: "component" | "project" | "member"
  id: string
  title: string
  subtitle: string
  href: string
}

// ponytail: loads rows and filters in JS so tech-stack tags inside the JSON column match too.
// Fine for club-sized data; the SCAN_CAP bounds worst-case memory/CPU for this unauthenticated path
// so it can't be turned into a load amplifier — switch to Postgres full-text search if we outgrow it.
const SCAN_CAP = 2000
export async function searchAll(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hit = (...fields: (string | null | undefined)[]) =>
    fields.some((f) => f?.toLowerCase().includes(q))

  // Emails are private: only admins can find members by email (no enumeration by visitors).
  const admin = await isAdmin()
  const [components, projects, members] = await Promise.all([
    db.component.findMany({
      take: SCAN_CAP,
      select: { id: true, name: true, modelNumber: true, location: true, category: true, description: true },
    }),
    db.project.findMany({ take: SCAN_CAP, select: { id: true, title: true, description: true, status: true, techStack: true } }),
    db.member.findMany({
      where: { guest: false },
      take: SCAN_CAP,
      select: { id: true, name: true, rollNumber: true, email: true, department: true },
    }),
  ])

  return [
    ...components
      .filter((c) => hit(c.name, c.modelNumber, c.location, c.description))
      .slice(0, limit)
      .map((c) => ({
        type: "component" as const,
        id: c.id,
        title: c.name,
        subtitle: [c.modelNumber, c.location].filter(Boolean).join(" · "),
        href: `/inventory/${c.id}`,
      })),
    ...projects
      .filter((p) => hit(p.title, p.description, JSON.stringify(p.techStack)))
      .slice(0, limit)
      .map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.title,
        subtitle: p.description?.slice(0, 80) ?? "",
        href: `/projects/${p.id}`,
      })),
    ...members
      .filter((m) => hit(m.name, m.rollNumber, admin ? m.email : null, m.department))
      .slice(0, limit)
      .map((m) => ({
        type: "member" as const,
        id: m.id,
        title: m.name,
        subtitle: `${m.rollNumber} · ${m.department}`,
        href: `/members/${m.id}`,
      })),
  ]
}
