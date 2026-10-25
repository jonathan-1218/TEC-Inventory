"use client"

import { useState, useTransition } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/form-field"
import { requestComponent } from "@/app/actions/requests"
import { formValues, runAction } from "@/lib/client"
import { cn } from "@/lib/utils"

export type RequestOption = { id: string; name: string; modelNumber: string | null; quantityAvailable: number }

/** Open to everyone: a student picks a component and leaves their details; an admin approves it later. */
export function RequestDialog({ components, trigger }: { components: RequestOption[]; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="eyebrow">Students</p>
          <DialogTitle>Request a component</DialogTitle>
          <DialogDescription>Fill this in and a club officer will approve it and hand it over.</DialogDescription>
        </DialogHeader>
        {open && <RequestForm components={components} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RequestForm({ components, onDone }: { components: RequestOption[]; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [componentId, setComponentId] = useState("")
  const [pick, setPick] = useState(false)
  const selected = components.find((c) => c.id === componentId)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = { ...formValues(e.currentTarget), componentId }
    startTransition(async () => {
      const res = await runAction(requestComponent(values), "Request sent — an officer will get back to you")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="request-form" onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Full name" htmlFor="req-name" error={errors.name}>
          <Input id="req-name" name="name" autoComplete="name" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Register no." htmlFor="req-roll" error={errors.rollNumber}>
            <Input id="req-roll" name="rollNumber" autoCapitalize="characters" required />
          </FormField>
          <FormField label="Year" error={errors.yearOfStudy}>
            <Select name="yearOfStudy" required>
              <SelectTrigger className="w-full" aria-label="Year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    Year {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="Department" htmlFor="req-dept" error={errors.department}>
          <Input id="req-dept" name="department" placeholder="e.g. ECE" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-[1fr_5.5rem]">
          <FormField label="Component" error={errors.componentId}>
            <Popover open={pick} onOpenChange={setPick} modal>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={pick} className="w-full justify-between font-normal">
                  <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.name ?? "Search or choose…"}</span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search components…" />
                  <CommandList>
                    <CommandEmpty>No component found.</CommandEmpty>
                    <CommandGroup>
                      {components.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.modelNumber ?? ""}`}
                          onSelect={() => {
                            setComponentId(c.id)
                            setPick(false)
                          }}
                        >
                          <Check className={cn(componentId === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{c.name}</span>
                          <span className={cn("text-muted-foreground ml-auto text-xs", c.quantityAvailable <= 0 && "text-danger")}>
                            {c.quantityAvailable > 0 ? `${c.quantityAvailable} left` : "none left"}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormField>
          <FormField label="Qty" htmlFor="req-qty" error={errors.quantity}>
            <Input id="req-qty" name="quantity" type="number" min={1} max={20} defaultValue={1} required />
          </FormField>
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="request-form" variant="brand" disabled={pending || !componentId}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </>
  )
}
