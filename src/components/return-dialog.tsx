"use client"

import { Children, useState, useTransition } from "react"
import type { ReturnCondition } from "@prisma/client"
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
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { returnIssuance } from "@/app/actions/issuances"
import { formValues, runAction } from "@/lib/client"
import { CONDITIONS, CONDITION_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

const today = () => new Date().toLocaleDateString("en-CA")

/** Selected look per condition — same tones as ConditionBadge. */
const CONDITION_ON: Record<ReturnCondition, string> = {
  WORKING: "border-foreground/40 bg-muted text-foreground",
  DAMAGED: "border-brand/60 bg-brand-soft text-brand-strong",
  LOST: "border-danger/50 bg-danger-soft text-danger",
}

const CONDITION_HINT: Record<ReturnCondition, string> = {
  WORKING: "Units go back to available stock.",
  DAMAGED: "Units move from working to damaged.",
  LOST: "Units are removed from the total.",
}

type ReturnTarget = { id: string; quantity: number; componentName: string; memberName: string }

/**
 * Return some or all units of an open issuance.
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function ReturnDialog({
  issuance,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  issuance: ReturnTarget
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
          <p className="eyebrow">Return</p>
          <DialogTitle>Return {issuance.componentName}</DialogTitle>
          <DialogDescription>
            {issuance.quantity} unit(s) out with {issuance.memberName}. Return fewer to keep the rest checked
            out.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <ReturnForm issuance={issuance} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ReturnForm({ issuance, onDone }: { issuance: ReturnTarget; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [condition, setCondition] = useState<ReturnCondition>("WORKING")

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(returnIssuance({ ...values, id: issuance.id }), "Return recorded")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id={`return-form-${issuance.id}`} onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Quantity returned" htmlFor={`ret-qty-${issuance.id}`} error={errors.quantity}>
            <Input
              id={`ret-qty-${issuance.id}`}
              name="quantity"
              type="number"
              min={1}
              max={issuance.quantity}
              defaultValue={issuance.quantity}
              required
            />
          </FormField>
          <FormField label="Returned on" htmlFor={`ret-date-${issuance.id}`} error={errors.returnedDate}>
            <Input
              id={`ret-date-${issuance.id}`}
              name="returnedDate"
              type="date"
              defaultValue={today()}
              required
            />
          </FormField>
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm leading-none font-medium select-none">Condition</legend>
          <div className="grid grid-cols-3 gap-2">
            {CONDITIONS.map((c) => (
              <label
                key={c}
                className={cn(
                  "ease-snap flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 pointer-coarse:py-3",
                  condition !== c && "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  condition === c && CONDITION_ON[c]
                )}
              >
                <input
                  type="radio"
                  name="condition"
                  value={c}
                  checked={condition === c}
                  onChange={() => setCondition(c)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", condition === c ? "bg-current" : "ring-1 ring-current ring-inset")}
                />
                {CONDITION_LABELS[c]}
              </label>
            ))}
          </div>
          <p className={cn("text-xs", errors.condition ? "text-danger font-medium" : "text-muted-foreground")} role={errors.condition ? "alert" : undefined}>
            {errors.condition?.[0] ?? CONDITION_HINT[condition]}
          </p>
        </fieldset>
        <FormField label="Notes" htmlFor={`ret-notes-${issuance.id}`} error={errors.notes}>
          <Textarea
            id={`ret-notes-${issuance.id}`}
            name="notes"
            rows={2}
            placeholder="e.g. one servo has a stripped gear"
          />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form={`return-form-${issuance.id}`} variant="brand" disabled={pending}>
          {pending ? "Saving…" : "Record return"}
        </Button>
      </DialogFooter>
    </>
  )
}
