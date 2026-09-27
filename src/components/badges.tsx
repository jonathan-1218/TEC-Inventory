import type { Category, ProjectStatus, ReturnCondition } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type StockStatus,
} from "@/lib/labels"

// Tinted badges that read in both light and dark mode.
const tone = {
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/12 text-red-700 dark:text-red-400",
  blue: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-400",
  gray: "bg-muted text-muted-foreground",
} as const

export type Tone = keyof typeof tone

export function ToneBadge({
  tone: t,
  className,
  children,
}: {
  tone: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge variant="secondary" className={cn(tone[t], className)}>
      {children}
    </Badge>
  )
}

const STOCK: Record<StockStatus, { tone: Tone; label: string }> = {
  ok: { tone: "green", label: "In stock" },
  low: { tone: "amber", label: "Low stock" },
  out: { tone: "red", label: "Out of stock" },
}

export function StockBadge({ status }: { status: StockStatus }) {
  return <ToneBadge tone={STOCK[status].tone}>{STOCK[status].label}</ToneBadge>
}

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  PLANNING: "violet",
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  COMPLETED: "green",
  DROPPED: "gray",
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <ToneBadge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</ToneBadge>
}

const CONDITION_TONE: Record<ReturnCondition, Tone> = {
  WORKING: "green",
  DAMAGED: "amber",
  LOST: "red",
}

export function ConditionBadge({ condition }: { condition: ReturnCondition }) {
  return <ToneBadge tone={CONDITION_TONE[condition]}>{CONDITION_LABELS[condition]}</ToneBadge>
}

export function CategoryBadge({ category }: { category: Category }) {
  return <Badge variant="outline">{CATEGORY_LABELS[category]}</Badge>
}

/** Open issuance status: overdue / due / returned. */
export function IssuanceStatusBadge({
  returned,
  overdueDays,
}: {
  returned: boolean
  /** > 0 when past the expected return date. */
  overdueDays: number
}) {
  if (returned) return <ToneBadge tone="gray">Returned</ToneBadge>
  if (overdueDays > 0) return <ToneBadge tone="red">Overdue {overdueDays}d</ToneBadge>
  return <ToneBadge tone="blue">Out</ToneBadge>
}
