import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-card/60 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      {/* Like the logo: a signal runs into the block… and nothing comes out the other side. */}
      <div aria-hidden className="mb-1 flex items-center">
        <svg viewBox="0 0 56 20" className="text-brand h-5 w-14" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 10h22l3-6 4 12 3-9 2 3h20" />
        </svg>
        {Icon && (
          <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-md ring-1 ring-border">
            <Icon className="size-5" />
          </span>
        )}
        <svg viewBox="0 0 56 20" className="text-border h-5 w-14" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeDasharray="2 4">
          <path d="M3 10h52" />
        </svg>
      </div>
      <p className="font-semibold tracking-tight">{title}</p>
      {description && <p className="text-muted-foreground max-w-sm text-sm text-pretty">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
