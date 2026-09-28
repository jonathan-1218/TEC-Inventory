import { z } from "zod"
import type { Category, Designation, ProjectStatus, ReturnCondition, TaskPriority, TaskStatus } from "@prisma/client"
import { CATEGORIES, CONDITIONS, DESIGNATIONS, STATUSES, TECH_STACK_KEYS } from "@/lib/labels"
import { parseDateInput, todayNoonUTC } from "@/lib/dates"

// Inputs arrive from forms, so "" means "not provided".
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v)

const reqStr = (max: number) => z.string().trim().min(1, "Required").max(max)
const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : emptyToNull(v)),
    z.string().max(max).nullable()
  )
const int = (min = 0) =>
  z.coerce.number().int("Must be a whole number").min(min, `Must be at least ${min}`).max(100_000, "Too large")
const optNum = z.preprocess(emptyToNull, z.coerce.number().min(0, "Must be 0 or more").max(10_000_000, "Too large").nullable())
const id = z.string().min(1, "Required")
const optId = z.preprocess((v) => (v === "" || v === "none" ? null : emptyToNull(v)), z.string().nullable())
const bool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean())

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  // Rejects dates like 2026-02-31 that JS would silently roll over.
  .refine((s) => {
    const d = parseDateInput(s)
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
  }, "Not a real date")
  .transform(parseDateInput)
const optDate = z.preprocess(emptyToNull, dateStr.nullable())

const category = z.enum(CATEGORIES as [Category, ...Category[]])
const designation = z.enum(DESIGNATIONS as [Designation, ...Designation[]])
const status = z.enum(STATUSES as [ProjectStatus, ...ProjectStatus[]])
const condition = z.enum(CONDITIONS as [ReturnCondition, ...ReturnCondition[]])

/** Accepts ["a","b"] or "a, b" and returns a de-duplicated list of trimmed tags. */
const tagList = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",") : (v ?? [])),
  z
    .array(z.string())
    .transform((a) => [...new Set(a.map((s) => s.trim()).filter(Boolean))])
    .refine((a) => a.length <= 30 && a.every((t) => t.length <= 40), "Keep it to 30 tags of up to 40 characters")
)

export const idSchema = z.object({ id })

// ---------- Components ----------

const componentBase = z.object({
  name: reqStr(120),
  modelNumber: optStr(80),
  category,
  description: optStr(2000),
  quantityTotal: int(),
  quantityWorking: int(),
  quantityDamaged: int(),
  quantityUnderRepair: int(),
  location: optStr(80),
  unitCost: optNum,
  datasheetUrl: z.preprocess(emptyToNull, z.url("Must be a valid URL").nullable()),
  lowStockThreshold: int(),
  notes: optStr(2000),
})

function checkQuantities(
  c: { quantityTotal: number; quantityWorking: number; quantityDamaged: number; quantityUnderRepair: number },
  ctx: z.RefinementCtx
) {
  if (c.quantityWorking + c.quantityDamaged + c.quantityUnderRepair !== c.quantityTotal) {
    ctx.addIssue({
      code: "custom",
      path: ["quantityTotal"],
      message: `Working + damaged + under repair (${c.quantityWorking + c.quantityDamaged + c.quantityUnderRepair}) must equal total (${c.quantityTotal})`,
    })
  }
}

export const componentCreateSchema = componentBase.superRefine(checkQuantities)
export const componentUpdateSchema = componentBase.extend({ id }).superRefine(checkQuantities)

// ---------- Members ----------

const memberBase = z.object({
  name: reqStr(100),
  rollNumber: reqStr(40).transform((s) => s.toUpperCase()),
  department: reqStr(80),
  yearOfStudy: int(1).max(6, "Must be 6 or less"),
  designation,
  email: z.string().trim().toLowerCase().pipe(z.email("Must be a valid email")),
  phone: optStr(20),
  isActive: bool,
})

export const memberCreateSchema = memberBase
export const memberUpdateSchema = memberBase.extend({ id })

// ---------- Teams ----------

const teamBase = z.object({
  name: reqStr(80),
  description: optStr(1000),
})

export const teamCreateSchema = teamBase
export const teamUpdateSchema = teamBase.extend({ id })

export const teamMemberSchema = z.object({
  teamId: id,
  memberId: id,
  roleInTeam: reqStr(60),
})
export const teamMemberRemoveSchema = z.object({ teamId: id, memberId: id })

// ---------- Projects ----------

export const techStackSchema = z.object(
  Object.fromEntries(TECH_STACK_KEYS.map((k) => [k, tagList])) as Record<
    (typeof TECH_STACK_KEYS)[number],
    typeof tagList
  >
)

const projectBase = z.object({
  title: reqStr(120),
  description: optStr(5000),
  teamId: optId,
  techStack: techStackSchema,
  status,
  progressPercent: int().max(100, "Must be 100 or less"),
  startDate: optDate,
  targetDate: optDate,
})

function checkProjectDates(p: { startDate: Date | null; targetDate: Date | null }, ctx: z.RefinementCtx) {
  if (p.startDate && p.targetDate && p.targetDate < p.startDate) {
    ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Target date can't be before start date" })
  }
}

export const projectCreateSchema = projectBase.superRefine(checkProjectDates)
export const projectUpdateSchema = projectBase.extend({ id }).superRefine(checkProjectDates)

export const projectMemberSchema = z.object({
  projectId: id,
  memberId: id,
  roleInProject: reqStr(60),
})
export const projectMemberRemoveSchema = z.object({ projectId: id, memberId: id })

export const projectComponentSchema = z.object({
  projectId: id,
  componentId: id,
  quantityRequired: int(1),
})
export const projectComponentRemoveSchema = z.object({ projectId: id, componentId: id })

export const progressUpdateSchema = z.object({
  projectId: id,
  date: dateStr,
  note: reqStr(2000),
  percentAtUpdate: int().max(100, "Must be 100 or less"),
  updatedByMemberId: optId,
})

// ---------- Issuances ----------

export const issueSchema = z
  .object({
    componentId: id,
    quantity: int(1),
    issuedToMemberId: id,
    projectId: optId,
    issuedDate: dateStr,
    expectedReturnDate: optDate,
    notes: optStr(1000),
  })
  .superRefine((v, ctx) => {
    if (v.expectedReturnDate && v.expectedReturnDate < v.issuedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedReturnDate"],
        message: "Expected return can't be before the issue date",
      })
    }
  })

export const returnSchema = z.object({
  id,
  quantity: int(1),
  condition,
  returnedDate: dateStr,
  notes: optStr(1000),
})

/** Push an open issuance's expected return date out (never into the past). */
export const extendDueSchema = z.object({
  id,
  expectedReturnDate: dateStr.refine((d) => d >= todayNoonUTC(), "Can't be before today"),
})

// ---------- Tasks ----------

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const satisfies readonly TaskStatus[]
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const satisfies readonly TaskPriority[]
const taskStatus = z.enum(TASK_STATUSES)

const taskFields = z.object({
  title: reqStr(160),
  description: optStr(2000),
  status: taskStatus,
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: optId,
  dueDate: optDate,
})

export const taskCreateSchema = taskFields.extend({
  projectId: id,
  status: taskStatus.default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
})
/** Partial: send only the fields that changed ("" / "none" clears an optional field). */
export const taskUpdateSchema = taskFields.partial().extend({ id })
/** `order` = 0-based position in the target column, counted without the moved task (like arrayMove). */
export const taskMoveSchema = z.object({ id, status: taskStatus, order: int() })
export const taskDoneSchema = z.object({ id, done: bool })

export const loginSchema = z.object({ password: z.string().min(1, "Enter the admin password") })

export type IssueInput = z.output<typeof issueSchema>
export type ReturnInput = z.output<typeof returnSchema>
export type ExtendDueInput = z.output<typeof extendDueSchema>
export type TaskCreateInput = z.output<typeof taskCreateSchema>
export type TaskUpdateInput = z.output<typeof taskUpdateSchema>
export type TaskMoveInput = z.output<typeof taskMoveSchema>
