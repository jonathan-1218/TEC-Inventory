"use client"

import { useTransition } from "react"
import { Check, Inbox, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { approveRequest, rejectRequest } from "@/app/actions/requests"
import { runAction } from "@/lib/client"

export type PendingRequest = {
  id: string
  name: string
  rollNumber: string
  department: string
  yearOfStudy: number
  quantity: number
  component: string
  available: number
}

/** Admin only: pending student requests, one click to issue (14 days) or reject. */
export function RequestsPanel({ requests }: { requests: PendingRequest[] }) {
  const [pending, startTransition] = useTransition()
  if (!requests.length) return null
  const act = (fn: typeof approveRequest, id: string, done: string) =>
    startTransition(async () => void (await runAction(fn({ id }), done)))

  return (
    <section aria-label="Component requests" className="bg-card rounded-xl border p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Inbox className="size-4" /> Requests from students
        <span className="bg-brand-soft text-brand-strong rounded-full px-2 py-0.5 font-mono text-xs">{requests.length}</span>
      </h2>
      <ul className="divide-y">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {r.name} <span className="text-muted-foreground font-mono text-xs">{r.rollNumber}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {r.department} · Year {r.yearOfStudy} · wants {r.quantity} × {r.component} ({r.available} available)
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="brand" disabled={pending || r.available < r.quantity} onClick={() => act(approveRequest, r.id, "Issued")}>
                <Check /> Issue
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(rejectRequest, r.id, "Request removed")}>
                <X /> Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
