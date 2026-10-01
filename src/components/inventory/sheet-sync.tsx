"use client"

import { useTransition } from "react"
import { ExternalLink, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { syncSheetNow } from "@/app/actions/sheets"
import { runAction } from "@/lib/client"

/** Admin-only: open the mirrored Google Sheet, or force a full re-sync now. */
export function SheetSync({ url }: { url: string }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex">
      <Button
        variant="outline"
        className="rounded-r-none"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runAction(syncSheetNow())
            if (res.ok) toast.success(`Synced ${res.data.rows} parts to Google Sheets`)
          })
        }
      >
        <FileSpreadsheet /> {pending ? "Syncing…" : "Sync to Sheets"}
      </Button>
      <Button variant="outline" size="icon" className="-ml-px rounded-l-none" asChild>
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open the Google Sheet">
          <ExternalLink />
        </a>
      </Button>
    </div>
  )
}
