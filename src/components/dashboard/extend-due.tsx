"use client"

import { useState, useTransition } from "react"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { extendDueDate } from "@/app/actions/issuances"
import { formatDay } from "@/components/charts/shared"
import { runAction } from "@/lib/client"
import { parseDateInput, toDateInput } from "@/lib/dates"

const addDays = (day: string, n: number) => toDateInput(new Date(parseDateInput(day).getTime() + n * 86_400_000))
const QUICK = [3, 7, 14]

/** Small date popover to push an open checkout's expected return date (admin). */
export function ExtendDue({ id, due, label }: { id: string; due: string; label: string }) {
  const [open, setOpen] = useState(false)
  const today = new Date().toLocaleDateString("en-CA")
  // Quick picks count from the later of today and the current due date.
  const base = due > today ? due : today
  const [date, setDate] = useState(() => addDays(base, 7))
  const [pending, startTransition] = useTransition()

  function save(value: string) {
    startTransition(async () => {
      const res = await runAction(extendDueDate({ id, expectedReturnDate: value }), `Due date moved to ${formatDay(value)}`)
      if (res.ok) setOpen(false)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Extend due date: ${label}`} title="Extend due date">
          <CalendarPlus />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader>
          <PopoverTitle>Extend due date</PopoverTitle>
          <PopoverDescription className="text-xs">
            {label} · due {formatDay(due)}
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK.map((n) => {
            const value = addDays(base, n)
            return (
              <Button key={n} type="button" variant="outline" size="sm" disabled={pending} onClick={() => save(value)} className="font-mono text-[11px]">
                +{n === 7 ? "1w" : n === 14 ? "2w" : `${n}d`}
              </Button>
            )
          })}
        </div>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            save(date)
          }}
        >
          <Input type="date" aria-label="New due date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required className="h-8 font-mono text-xs" />
          <Button type="submit" size="sm" disabled={pending || !date} className="h-8">
            {pending ? "Saving…" : "Set"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
