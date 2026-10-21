import type * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * A dashboard panel: DESIGN.md card anatomy (eyebrow → title → description, action top-right) and a reveal slot.
 * `i` is the stagger position (see stage.module.css).
 */
export function Panel({
  i,
  id,
  eyebrow,
  title,
  description,
  action,
  actionClassName,
  className,
  contentClassName,
  children,
}: {
  i: number
  id?: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  actionClassName?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card
      data-panel
      id={id}
      style={{ "--i": i } as React.CSSProperties}
      className={cn("min-w-0 scroll-mt-20 [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]", className)}
    >
      <CardHeader className="gap-1.5">
        {/* col-start-1 keeps the text in one column when a phone layout moves the action under it. */}
        {eyebrow && <p className="eyebrow col-start-1">{eyebrow}</p>}
        <CardTitle role="heading" aria-level={2} className="col-start-1">
          {title}
        </CardTitle>
        {description && <CardDescription className="col-start-1 text-pretty">{description}</CardDescription>}
        {action && <CardAction className={actionClassName}>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

/** Ghost "More →" link for a panel's action slot. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-mr-2 text-muted-foreground hover:text-foreground">
      <Link href={href}>
        {children} <ArrowRight />
      </Link>
    </Button>
  )
}

/** Suspense fallback: rows of bars roughly the size of what's loading. */
export function PanelSkeleton({ rows = 4, height }: { rows?: number; height?: number }) {
  if (height) return <Skeleton className="w-full rounded-lg" style={{ height }} />
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 rounded-md" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}
