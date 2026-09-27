import type { Category, Designation, ProjectStatus, ReturnCondition } from "@prisma/client"

export const CATEGORY_LABELS: Record<Category, string> = {
  MICROCONTROLLER: "Microcontroller",
  SENSOR: "Sensor",
  ACTUATOR_MOTOR: "Actuator/Motor",
  POWER: "Power",
  COMMUNICATION: "Communication",
  DISPLAY: "Display",
  TOOL: "Tool",
  CONSUMABLE: "Consumable",
  MISC: "Misc",
}

export const DESIGNATION_LABELS: Record<Designation, string> = {
  PRESIDENT: "President",
  VICE_PRESIDENT: "Vice President",
  SECRETARY: "Secretary",
  JOINT_SECRETARY: "Joint Secretary",
  TREASURER: "Treasurer",
  CORE_MEMBER: "Core Member",
  MEMBER: "Member",
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
}

export const CONDITION_LABELS: Record<ReturnCondition, string> = {
  WORKING: "Working",
  DAMAGED: "Damaged",
  LOST: "Lost",
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
export const DESIGNATIONS = Object.keys(DESIGNATION_LABELS) as Designation[]
export const STATUSES = Object.keys(STATUS_LABELS) as ProjectStatus[]
export const CONDITIONS = Object.keys(CONDITION_LABELS) as ReturnCondition[]

export const TECH_STACK_KEYS = ["languages", "frameworks", "hardware", "tools", "cloud"] as const
export type TechStackKey = (typeof TECH_STACK_KEYS)[number]
export type TechStack = Record<TechStackKey, string[]>

export const TECH_STACK_LABELS: Record<TechStackKey, string> = {
  languages: "Languages",
  frameworks: "Frameworks",
  hardware: "Hardware",
  tools: "Tools",
  cloud: "Cloud",
}

/** Normalise whatever is in the Json column into a full TechStack. */
export function parseTechStack(value: unknown): TechStack {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  return Object.fromEntries(
    TECH_STACK_KEYS.map((k) => [k, Array.isArray(obj[k]) ? obj[k].map(String) : []])
  ) as TechStack
}

export type StockStatus = "out" | "low" | "ok"

export function stockStatus(available: number, lowStockThreshold: number): StockStatus {
  if (available <= 0) return "out"
  if (available <= lowStockThreshold) return "low"
  return "ok"
}
