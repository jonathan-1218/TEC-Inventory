import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Label + control + optional hint/error, stacked. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: React.ReactNode
  htmlFor?: string
  error?: string | string[]
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const message = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {message ? (
        <p role="alert" className="text-danger flex items-center gap-1 text-xs font-medium">
          <span aria-hidden className="bg-danger size-1.5 shrink-0 rounded-full" />
          {message}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
