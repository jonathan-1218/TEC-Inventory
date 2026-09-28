import type { Category, ProjectStatus, ReturnCondition } from "@prisma/client"
import { CheckIcon, PauseIcon, TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type StockStatus,
} from "@/lib/labels"

// Lab-bench status system: no extra hues. State reads through fill / outline / hatch / intensity + icon + label.
// See DESIGN.md "Status system".
const tone = {
  neutral: "border-border text-foreground",
  muted: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-strong",
  brandOutline: "border-brand/50 text-brand-strong",
  ink: "bg-foreground text-background",
  danger: "bg-danger-soft text-danger",
  // Legacy names (pre-redesign call sites) mapped onto the palette. Prefer the names above.
  green: "border-border text-foreground",
  amber: "bg-brand-soft text-brand-strong",
  red: "bg-danger-soft text-danger",
  blue: "border-brand/50 text-brand-strong",
  violet: "border-border text-foreground",
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
    <Badge variant="outline" className={cn("border-transparent", tone[t], className)}>
      {children}
    </Badge>
  )
}

/** Small status LED. `hollow` = off/idle. */
function Led({ className, hollow }: { className?: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", hollow ? "ring-1 ring-current ring-inset" : "bg-current", className)}
    />
  )
}

const STOCK: Record<StockStatus, { tone: Tone; label: string; led: string }> = {
  ok: { tone: "neutral", label: "In stock", led: "text-foreground/70" },
  low: { tone: "brand", label: "Low stock", led: "text-brand" },
  out: { tone: "neutral", label: "Out of stock", led: "text-brand-foreground" },
}

export function StockBadge({ status }: { status: StockStatus }) {
  const s = STOCK[status]
  return (
    <ToneBadge tone={s.tone} className={cn(status === "out" && "border-transparent bg-brand font-semibold text-brand-foreground")}>
      <Led className={s.led} />
      {s.label}
    </ToneBadge>
  )
}

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const label = STATUS_LABELS[status]
  switch (status) {
    case "PLANNING":
      return (
        <ToneBadge tone="neutral" className={cn("text-muted-foreground", className)}>
          <Led hollow />
          {label}
        </ToneBadge>
      )
    case "IN_PROGRESS":
      return (
        <ToneBadge tone="brand" className={className}>
          <Led className="text-brand" />
          {label}
        </ToneBadge>
      )
    case "ON_HOLD":
      return (
        <ToneBadge
          tone="brandOutline"
          className={cn("hatch [--hatch:color-mix(in_oklab,var(--brand)_24%,transparent)]", className)}
        >
          <PauseIcon aria-hidden />
          {label}
        </ToneBadge>
      )
    case "COMPLETED":
      return (
        <ToneBadge tone="ink" className={className}>
          <CheckIcon aria-hidden />
          {label}
        </ToneBadge>
      )
    case "DROPPED":
      return (
        <ToneBadge tone="muted" className={cn("line-through decoration-1", className)}>
          {label}
        </ToneBadge>
      )
  }
}

// String unions (not Prisma imports) so these work before/without the generated Task enums.
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH"

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}

/** Ring (to do) → half disc (in progress) → filled check (done). Also usable bare, e.g. in a checklist. */
export function TaskStatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  if (status === "DONE") {
    return (
      <span
        aria-hidden
        className={cn("bg-foreground text-background grid size-3.5 shrink-0 place-items-center rounded-full", className)}
      >
        <CheckIcon className="size-2.5! stroke-3" />
      </span>
    )
  }
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      <circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "IN_PROGRESS" && <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />}
    </svg>
  )
}

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const t: Tone = status === "IN_PROGRESS" ? "brand" : status === "DONE" ? "muted" : "neutral"
  return (
    <ToneBadge tone={t} className={cn(status === "TODO" && "text-muted-foreground", className)}>
      <TaskStatusIcon status={status} className={cn(status === "DONE" && "size-3")} />
      {TASK_STATUS_LABELS[status]}
    </ToneBadge>
  )
}

/** Three signal bars; filled = priority level. */
export function PriorityBars({ priority, className }: { priority: TaskPriority; className?: string }) {
  const level = priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1
  return (
    <span aria-hidden className={cn("inline-flex h-2.5 items-end gap-px", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i < level ? "bg-current" : "bg-current/25")}
          style={{ height: `${40 + i * 30}%` }}
        />
      ))}
    </span>
  )
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const t: Tone = priority === "HIGH" ? "brand" : "neutral"
  return (
    <ToneBadge tone={t} className={cn(priority === "LOW" && "text-muted-foreground", className)}>
      <PriorityBars priority={priority} />
      {PRIORITY_LABELS[priority]}
    </ToneBadge>
  )
}

const CONDITION_TONE: Record<ReturnCondition, Tone> = {
  WORKING: "neutral",
  DAMAGED: "brand",
  LOST: "danger",
}

export function ConditionBadge({ condition }: { condition: ReturnCondition }) {
  return <ToneBadge tone={CONDITION_TONE[condition]}>{CONDITION_LABELS[condition]}</ToneBadge>
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <Badge variant="outline" className="text-muted-foreground font-mono text-[10.5px] tracking-wide uppercase">
      {CATEGORY_LABELS[category]}
    </Badge>
  )
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
  if (returned)
    return (
      <ToneBadge tone="muted">
        <CheckIcon aria-hidden />
        Returned
      </ToneBadge>
    )
  if (overdueDays > 0)
    return (
      <ToneBadge tone="danger" className="tabular-nums">
        <TriangleAlertIcon aria-hidden />
        Overdue {overdueDays}d
      </ToneBadge>
    )
  return (
    <ToneBadge tone="neutral">
      <Led className="text-brand" />
      Out
    </ToneBadge>
  )
}
