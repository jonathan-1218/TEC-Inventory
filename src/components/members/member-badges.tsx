import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PriorityBars } from "@/components/badges"
import type { DesignationTier } from "@/lib/designations"
import { cn } from "@/lib/utils"

/** Quiet hierarchy: signal bars (3 office bearer · 2 core · 1 member) + label, no coloured chips. */
export function DesignationBadge({ label, tier, className }: { label: string; tier: DesignationTier; className?: string }) {
  const level = tier === "MEMBER" ? "LOW" : tier === "CORE" ? "MEDIUM" : "HIGH"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        level === "HIGH" ? "text-foreground font-semibold" : level === "MEDIUM" ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      <PriorityBars priority={level} className={cn(level === "HIGH" && "text-brand-strong")} />
      {label}
    </span>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", active ? "bg-foreground/70" : "ring-1 ring-current ring-inset")}
      />
      {active ? "Active" : "Inactive"}
    </span>
  )
}

/** Rounded-square avatar with mono initials (no photos in the data). */
export function MemberAvatar({
  name,
  size,
  className,
}: {
  name: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
  return (
    <Avatar size={size} className={className} aria-hidden>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
