export function PageHeader({
  title,
  eyebrow,
  description,
  children,
}: {
  title: React.ReactNode
  /** Small silkscreen label above the title, e.g. "Stock" or "Project · 3 of 5". */
  eyebrow?: React.ReactNode
  description?: React.ReactNode
  /** Action buttons, shown on the right (below the title on mobile). */
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-2.5 flex items-center gap-2">
            <span aria-hidden className="bg-brand h-2.5 w-[3px] rounded-[1px]" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[1.625rem] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance sm:text-[2rem]">
          {title}
        </h1>
        {description && <p className="text-muted-foreground mt-2 max-w-2xl text-sm text-pretty">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{children}</div>}
    </div>
  )
}
