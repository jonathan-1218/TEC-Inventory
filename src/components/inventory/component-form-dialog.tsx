"use client"

import { useState, useTransition } from "react"
import type { Component } from "@prisma/client"
import { CircleAlert, CircleCheck } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { createComponent, updateComponent } from "@/app/actions/components"
import { formValues, runAction } from "@/lib/client"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

/**
 * Add (no `component`) or edit a component.
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function ComponentFormDialog({
  component,
  issued = 0,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  component?: Component
  /** Units currently out on open issuances; working can't go below this. */
  issued?: number
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
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{component ? `Edit ${component.name}` : "Add component"}</DialogTitle>
          <DialogDescription>
            {component ? "Update details and stock counts." : "Add a new item to the club inventory."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <ComponentForm component={component} issued={issued} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

const QTY_FIELDS = [
  { name: "quantityWorking", label: "Working" },
  { name: "quantityDamaged", label: "Damaged" },
  { name: "quantityUnderRepair", label: "Under repair" },
] as const

type QtyName = (typeof QTY_FIELDS)[number]["name"]

const num = (s: string) => Number(s) || 0

const required = (label: string) => (
  <>
    {label} <span className="text-destructive">*</span>
  </>
)

function ComponentForm({
  component: c,
  issued,
  onDone,
}: {
  component?: Component
  issued: number
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState<Record<QtyName, string>>({
    quantityWorking: String(c?.quantityWorking ?? 0),
    quantityDamaged: String(c?.quantityDamaged ?? 0),
    quantityUnderRepair: String(c?.quantityUnderRepair ?? 0),
  })
  // null = total follows the sum; a string once the user types their own total.
  const [manualTotal, setManualTotal] = useState<string | null>(null)
  const sum = QTY_FIELDS.reduce((s, f) => s + num(qty[f.name]), 0)
  const total = manualTotal ?? String(sum)
  const matches = num(total) === sum

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(
        c ? updateComponent({ ...values, id: c.id }) : createComponent(values),
        c ? "Component updated" : "Component added"
      )
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="component-form" onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={required("Name")} htmlFor="cf-name" error={errors.name}>
            <Input id="cf-name" name="name" defaultValue={c?.name} required maxLength={120} placeholder="ESP32 DevKit V1" />
          </FormField>
          <FormField label="Model number" htmlFor="cf-model" error={errors.modelNumber}>
            <Input id="cf-model" name="modelNumber" defaultValue={c?.modelNumber ?? ""} maxLength={80} placeholder="ESP-WROOM-32" />
          </FormField>
          <FormField label={required("Category")} error={errors.category}>
            <Select name="category" defaultValue={c?.category} required>
              <SelectTrigger className="w-full" aria-label="Category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Location" htmlFor="cf-location" error={errors.location} hint="Shelf or box label">
            <Input id="cf-location" name="location" defaultValue={c?.location ?? ""} maxLength={80} placeholder="Shelf A · Box 3" />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="cf-description" error={errors.description}>
          <Textarea id="cf-description" name="description" rows={2} defaultValue={c?.description ?? ""} />
        </FormField>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Quantities</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {QTY_FIELDS.map((f) => (
              <FormField
                key={f.name}
                label={f.label}
                htmlFor={`cf-${f.name}`}
                error={errors[f.name]}
              >
                <Input
                  id={`cf-${f.name}`}
                  name={f.name}
                  type="number"
                  inputMode="numeric"
                  min={f.name === "quantityWorking" ? issued : 0}
                  step={1}
                  value={qty[f.name]}
                  onChange={(e) => setQty((q) => ({ ...q, [f.name]: e.target.value }))}
                  required
                  className="tabular-nums"
                />
              </FormField>
            ))}
            <FormField
              label="Total"
              htmlFor="cf-total"
              error={errors.quantityTotal}
              hint={
                manualTotal === null ? (
                  "Follows the sum"
                ) : (
                  <button type="button" className="underline underline-offset-2" onClick={() => setManualTotal(null)}>
                    Match sum
                  </button>
                )
              }
            >
              <Input
                id="cf-total"
                name="quantityTotal"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={total}
                onChange={(e) => setManualTotal(e.target.value)}
                required
                aria-invalid={!matches || undefined}
                className="tabular-nums"
              />
            </FormField>
          </div>
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs tabular-nums",
              matches ? "text-muted-foreground" : "text-destructive"
            )}
            aria-live="polite"
          >
            {matches ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
            {num(qty.quantityWorking)} working + {num(qty.quantityDamaged)} damaged + {num(qty.quantityUnderRepair)} under
            repair = {sum}
            {matches ? " total" : `, but total is ${num(total)}`}
          </p>
          {issued > 0 && (
            <p className="text-muted-foreground text-xs">
              {issued} unit(s) are currently issued and counted as working, so working can&apos;t drop below {issued}.
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Unit cost (₹)" htmlFor="cf-cost" error={errors.unitCost}>
            <Input
              id="cf-cost"
              name="unitCost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={c?.unitCost ?? ""}
              placeholder="Optional"
            />
          </FormField>
          <FormField
            label="Low-stock threshold"
            htmlFor="cf-threshold"
            error={errors.lowStockThreshold}
            hint="Flag as low when available units are at or below this"
          >
            <Input
              id="cf-threshold"
              name="lowStockThreshold"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={c?.lowStockThreshold ?? 2}
              required
            />
          </FormField>
        </div>
        <FormField label="Datasheet URL" htmlFor="cf-datasheet" error={errors.datasheetUrl}>
          <Input
            id="cf-datasheet"
            name="datasheetUrl"
            type="url"
            defaultValue={c?.datasheetUrl ?? ""}
            placeholder="https://…"
          />
        </FormField>
        <FormField label="Notes" htmlFor="cf-notes" error={errors.notes}>
          <Textarea id="cf-notes" name="notes" rows={2} defaultValue={c?.notes ?? ""} />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="component-form" disabled={pending}>
          {pending ? "Saving…" : c ? "Save changes" : "Add component"}
        </Button>
      </DialogFooter>
    </>
  )
}
