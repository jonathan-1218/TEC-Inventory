import { Skeleton } from "@/components/ui/skeleton"

/** Route-change placeholder in the page's own shape: header, a row of readouts, a ruled panel. */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="eyebrow flex items-center gap-2">
        <span aria-hidden className="bg-brand h-2.5 w-[3px] animate-pulse rounded-[1px]" />
        Loading
      </p>
      <div className="-mt-3 flex flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="bg-muted/40 border-b px-4 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0" style={{ opacity: 1 - i * 0.15 }}>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
