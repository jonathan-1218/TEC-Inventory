import { cache } from "react"
import { db } from "@/lib/db"

export type DesignationTier = "OFFICE" | "CORE" | "MEMBER"
export type DesignationOpt = { id: string; label: string; tier: DesignationTier; rank: number }

/** Every designation, in display order. One query per request (the layout and pages share it). */
export const getDesignations = cache(
  async (): Promise<DesignationOpt[]> => db.designationOption.findMany({ orderBy: [{ rank: "asc" }, { label: "asc" }] })
)

export const TIER_LABELS: Record<DesignationTier, string> = {
  OFFICE: "Office bearer (shown as a card)",
  CORE: "Core team",
  MEMBER: "Member",
}

/** id → option, for turning a member's stored designation into its label, tier and order. */
export const designationMap = (list: DesignationOpt[]) => new Map(list.map((d) => [d.id, d]))
export const labelOf = (map: Map<string, DesignationOpt>, id: string) => map.get(id)?.label ?? id
