import type { Designation } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { ToneBadge } from "@/components/badges"
import { DESIGNATIONS, DESIGNATION_LABELS } from "@/lib/labels"

/** Office bearers (President … Treasurer) come first in DESIGNATIONS. */
export const designationRank = (d: Designation) => DESIGNATIONS.indexOf(d)

export function DesignationBadge({ designation }: { designation: Designation }) {
  if (designation === "CORE_MEMBER") return <ToneBadge tone="blue">{DESIGNATION_LABELS[designation]}</ToneBadge>
  if (designation === "MEMBER") return <ToneBadge tone="gray">{DESIGNATION_LABELS[designation]}</ToneBadge>
  return <Badge>{DESIGNATION_LABELS[designation]}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <ToneBadge tone="green">Active</ToneBadge> : <ToneBadge tone="gray">Inactive</ToneBadge>
}
