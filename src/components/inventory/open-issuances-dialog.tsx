"use client"

import { Children } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IssuanceStatusBadge } from "@/components/badges"
import { ReturnDialog } from "@/components/return-dialog"
import { daysOverdue, formatDate } from "@/lib/dates"

export type OpenIssuance = {
  id: string
  quantity: number
  expectedReturnDate: Date | null
  member: { id: string; name: string }
}

/** Lists a component's open issuances, each with its own return flow. Controlled, or uncontrolled with `trigger`. */
export function OpenIssuancesDialog({
  componentName,
  issuances,
  trigger,
  open,
  onOpenChange,
}: {
  componentName: string
  issuances: OpenIssuance[]
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Return</p>
          <DialogTitle>Return {componentName}</DialogTitle>
          <DialogDescription>Choose the checkout being returned.</DialogDescription>
        </DialogHeader>
        {issuances.length === 0 ? (
          <p className="text-muted-foreground text-sm">All units are back in stock.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {issuances.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/members/${i.member.id}`} className="hover:text-brand-strong block truncate font-medium">
                    {i.member.name}
                  </Link>
                  <p className="text-muted-foreground font-mono text-xs tabular-nums">
                    {i.quantity} unit{i.quantity === 1 ? "" : "s"} ·{" "}
                    {i.expectedReturnDate ? `due ${formatDate(i.expectedReturnDate)}` : "no due date"}
                  </p>
                </div>
                <IssuanceStatusBadge
                  returned={false}
                  overdueDays={i.expectedReturnDate ? Math.max(0, daysOverdue(i.expectedReturnDate)) : 0}
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
