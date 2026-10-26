import { z } from "zod"
import type { Category, ProjectStatus, ReturnCondition, TaskPriority, TaskStatus } from "@prisma/client"
import { CATEGORIES, CONDITIONS, STATUSES, TECH_STACK_KEYS } from "@/lib/labels"
import { parseDateInput, todayNoonUTC } from "@/lib/dates"
import { PASSWORD_MIN, passwordProblems } from "@/lib/password-strength"

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
// A DesignationOption id; the database rejects an id that doesn't exist.
const designation = z.string().min(1, "Choose a designation")
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
  // Restrict scheme to http(s): z.url() alone accepts javascript:/data:/vbscript:, which become a
  // stored dangerous-scheme link at the world-readable inventory detail page (href sink).
  datasheetUrl: z.preprocess(emptyToNull, z.url({ protocol: /^https?$/, message: "Must be an http(s) URL" }).max(2048, "URL too long").nullable()),
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
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : emptyToNull(v)),
    z.email("Must be a valid email").max(200).nullable()
  ),
  phone: optStr(20),
  // Admin-uploaded JPEG (resized in the browser, ~40 KB) or an https image link. Nothing else is stored.
  photo: z.preprocess(
    emptyToNull,
    z
      .string()
      .max(150_000, "Photo is too large")
      .refine((v) => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\/\S+$/.test(v), "Use a JPEG upload or an https link")
      .nullable()
  ),
  bio: optStr(1000),
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

export const loginSchema = z.object({
  password: z.string().min(1, "Enter the admin password").max(200),
  code: z.string().trim().max(10).optional(),
})

// ---------- Team accounts ----------

const email = z.string().trim().toLowerCase().max(200).pipe(z.email("Must be a valid email"))

export const signupMemberSchema = z.object({
  name: reqStr(100),
  rollNumber: reqStr(40).transform((s) => s.toUpperCase()),
  department: reqStr(80),
  yearOfStudy: int(1).max(6, "Must be 6 or less"),
})

export const MAX_GROUP = 10

/** Words a team's password must not contain: the email's name part, member names and register numbers. */
export const personalWords = (email: string, members: { name: string; rollNumber: string }[]) => [
  email.split("@")[0],
  ...members.flatMap((m) => [...m.name.split(/\s+/), m.rollNumber]),
]

/** Public sign-up. members[0] is the person signing up (project lead). */
/** What an Account keeps in `signup` until it's approved. */
export const storedSignupSchema = z.object({
  kind: z.enum(["INDIVIDUAL", "GROUP"]),
  title: reqStr(120),
  // Optional only so sign-ups stored before team names existed still parse; the form requires it.
  teamName: optStr(80),
  description: optStr(2000),
  mentorId: id,
  members: z.array(signupMemberSchema).min(1).max(MAX_GROUP),
})
export type StoredSignup = z.output<typeof storedSignupSchema>

export const signupSchema = storedSignupSchema
  .extend({ email, password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200) })
  .superRefine((v, ctx) => {
    const problem = passwordProblems(v.password, personalWords(v.email, v.members))[0]
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem })
    if (v.kind === "INDIVIDUAL" && v.members.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["members"], message: "An individual project has exactly one member" })
    }
    if (v.kind === "GROUP" && v.members.length < 2) {
      ctx.addIssue({ code: "custom", path: ["members"], message: "A group project needs at least 2 members" })
    }
    const rolls = v.members.map((m) => m.rollNumber)
    if (new Set(rolls).size !== rolls.length) {
      ctx.addIssue({ code: "custom", path: ["members"], message: "Each member needs a different register number" })
    }
  })
export type SignupInput = z.input<typeof signupSchema>

export const designationSchema = z.object({
  label: reqStr(60),
  tier: z.enum(["OFFICE", "CORE", "MEMBER"]),
  rank: int().max(10_000, "Too large"),
})

export const resetPasswordSchema = z.object({
  id,
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200),
})

// ---------- Team portal settings (what a team lead may change about their own project) ----------

export const portalProjectSchema = z
  .object({
    projectId: id,
    title: reqStr(120),
    description: optStr(5000),
    status,
    techStack: techStackSchema,
    startDate: optDate,
    targetDate: optDate,
  })
  .superRefine(checkProjectDates)

export const portalTeamSchema = z.object({ projectId: id, name: reqStr(80), description: optStr(1000) })
export const portalMemberRoleSchema = z.object({ projectId: id, memberId: id, roleInProject: reqStr(60) })

export const changePasswordSchema = z.object({
  current: z.string().min(1, "Enter your current password").max(200),
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200),
})

export const teamLoginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(200) })

export const mentorSchema = z.object({
  name: reqStr(100),
  designation: reqStr(80),
  department: optStr(80),
})

// ---------- Goals ----------

/** Both blank clears the goal; otherwise both are required. */
export const goalSchema = z
  .object({
    goalPercent: z.preprocess(emptyToNull, z.coerce.number().int("Must be a whole number").min(1, "At least 1").max(100, "100 or less").nullable()),
    goalDate: optDate,
  })
  .superRefine((g, ctx) => {
    if ((g.goalPercent == null) !== (g.goalDate == null)) {
      ctx.addIssue({ code: "custom", path: [g.goalPercent == null ? "goalPercent" : "goalDate"], message: "Set both, or leave both blank" })
    }
  })

/** Public "request a component" form (a student, not a logged-in member). */
export const componentRequestSchema = z.object({
  name: reqStr(80),
  department: reqStr(80),
  rollNumber: reqStr(40).transform((s) => s.toUpperCase()),
  yearOfStudy: int(1).max(6, "Must be 6 or less"),
  componentId: id,
  quantity: int(1).max(20, "Ask for 20 or fewer"),
})

export type IssueInput = z.output<typeof issueSchema>
export type ReturnInput = z.output<typeof returnSchema>
export type ExtendDueInput = z.output<typeof extendDueSchema>
export type TaskCreateInput = z.output<typeof taskCreateSchema>
export type TaskUpdateInput = z.output<typeof taskUpdateSchema>
export type TaskMoveInput = z.output<typeof taskMoveSchema>
