"use client"

import { Children, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { extendDueDate } from "@/app/actions/issuances"
import { runAction } from "@/lib/client"
import { formatDate, parseDateInput, toDateInput } from "@/lib/dates"

const today = () => new Date().toLocaleDateString("en-CA")
const addDays = (day: string, n: number) => toDateInput(new Date(parseDateInput(day).getTime() + n * 86_400_000))

const QUICK = [
  { label: "+3 days", days: 3 },
  { label: "+1 week", days: 7 },
  { label: "+2 weeks", days: 14 },
]

export type ExtendTarget = {
  id: string
  componentName: string
  memberName: string
  expectedReturnDate: Date | null
}

/** Admin: move an open issuance's expected return date. Uncontrolled with `trigger`, or controlled. */
export function ExtendDueDialog({
  issuance,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  issuance: ExtendTarget
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setInternalOpen(o)
    onOpenChange?.(o)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="eyebrow">Due date</p>
          <DialogTitle>Extend {issuance.componentName}</DialogTitle>
          <DialogDescription>
            Out with {issuance.memberName} ·{" "}
            {issuance.expectedReturnDate ? `due ${formatDate(issuance.expectedReturnDate)}` : "no due date yet"}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the date resets each time. */}
        <ExtendForm issuance={issuance} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ExtendForm({ issuance, onDone }: { issuance: ExtendTarget; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string[]>()
  const now = today()
  const current = toDateInput(issuance.expectedReturnDate)
  // Quick picks count from the later of today and the current due date.
  const base = current > now ? current : now
  const [value, setValue] = useState(addDays(base, 7))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const res = await runAction(
        extendDueDate({ id: issuance.id, expectedReturnDate: value }),
        `Due date moved to ${formatDate(parseDateInput(value))}`
      )
      if (res.ok) onDone()
      else setError(res.fieldErrors?.expectedReturnDate)
    })
  }

  const formId = `extend-form-${issuance.id}`
  return (
    <>
      <form id={formId} onSubmit={onSubmit} className="grid gap-4">
        <div role="group" aria-label="Quick picks" className="grid grid-cols-3 gap-2">
          {QUICK.map((q) => {
            const day = addDays(base, q.days)
            const on = value === day
            return (
              <button
                key={q.days}
                type="button"
                aria-pressed={on}
                onClick={() => setValue(day)}
                className={
                  "ease-snap grid gap-0.5 rounded-lg border px-2 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 " +
                  (on ? "border-brand/60 bg-brand-soft text-brand-strong" : "bg-card hover:bg-muted")
                }
              >
                <span className="text-sm font-medium">{q.label}</span>
                <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                  {formatDate(parseDateInput(day))}
                </span>
              </button>
            )
          })}
        </div>
        <FormField label="New due date" htmlFor={`${formId}-date`} error={error}>
          <Input
            id={`${formId}-date`}
            type="date"
            min={now}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form={formId} variant="brand" disabled={pending || !value}>
          {pending ? "Saving…" : "Extend"}
        </Button>
      </DialogFooter>
    </>
  )
}
