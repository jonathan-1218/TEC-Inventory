import type { TaskPriority, TaskStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { calendarDay, isOverdue, toDateInput } from "@/lib/dates"
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  DESIGNATION_LABELS,
  STATUS_LABELS,
  TECH_STACK_KEYS,
  TECH_STACK_LABELS,
  parseTechStack,
} from "@/lib/labels"
import { getComponentsWithStock } from "@/lib/queries"

type Cell = string | number | boolean | Date | null | undefined

/**
 * One RFC 4180 field. Dates (calendar dates at 12:00 UTC) become YYYY-MM-DD. Text a spreadsheet
 * would run as a formula (leading = + - @, tab or CR) gets a leading ' (OWASP CSV injection).
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  let s = value instanceof Date ? toDateInput(value) : value
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
}

const TASK_STATUS: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" }
const TASK_PRIORITY: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }
const STOCK: Record<string, string> = { ok: "In stock", low: "Low", out: "Out" }
const day = (ts: Date | null) => ts && calendarDay(ts)

type Table = { headers: string[]; rows: Cell[][] }

/** Everything an admin can see in the app, one table per entity. */
export const EXPORTS: Record<string, () => Promise<Table>> = {
  async components() {
    const components = await getComponentsWithStock()
    return {
      headers: ["Name", "Model", "Category", "Total", "Working", "Damaged", "Under repair", "Issued", "Available", "Stock", "Low-stock threshold", "Location", "Unit cost (INR)", "Datasheet", "Description", "Notes"],
      rows: components.map((c) => [
        c.name, c.modelNumber, CATEGORY_LABELS[c.category], c.quantityTotal, c.quantityWorking, c.quantityDamaged,
        c.quantityUnderRepair, c.quantityIssued, c.quantityAvailable, STOCK[c.stockStatus], c.lowStockThreshold,
        c.location, c.unitCost, c.datasheetUrl, c.description, c.notes,
      ]),
    }
  },

  async issuances() {
    const issuances = await db.issuance.findMany({
      orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
      include: {
        component: { select: { name: true } },
        issuedTo: { select: { name: true, rollNumber: true } },
        project: { select: { title: true } },
      },
    })
    return {
      headers: ["Issued", "Component", "Quantity", "Member", "Roll number", "Project", "Expected return", "Returned", "Condition", "Status", "Notes"],
      rows: issuances.map((i) => [
        i.issuedDate, i.component.name, i.quantity, i.issuedTo.name, i.issuedTo.rollNumber, i.project?.title,
        i.expectedReturnDate, i.returnedDate, i.conditionOnReturn && CONDITION_LABELS[i.conditionOnReturn],
        i.returnedDate ? "Returned" : isOverdue(i) ? "Overdue" : "Open", i.notes,
      ]),
    }
  },

  async members() {
    const members = await db.member.findMany({
      orderBy: { name: "asc" },
      include: {
        teams: { select: { roleInTeam: true, team: { select: { name: true } } } },
        projects: { select: { roleInProject: true, project: { select: { title: true } } } },
      },
    })
    return {
      headers: ["Name", "Roll number", "Department", "Year", "Designation", "Email", "Phone", "Active", "Teams", "Projects"],
      rows: members.map((m) => [
        m.name, m.rollNumber, m.department, m.yearOfStudy, DESIGNATION_LABELS[m.designation], m.email, m.phone,
        m.isActive ? "Yes" : "No",
        m.teams.map((t) => `${t.team.name} (${t.roleInTeam})`).join("; "),
        m.projects.map((p) => `${p.project.title} (${p.roleInProject})`).join("; "),
      ]),
    }
  },

  async projects() {
    const [projects, tasks] = await Promise.all([
      db.project.findMany({
        orderBy: { title: "asc" },
        include: { team: { select: { name: true } }, _count: { select: { members: true } } },
      }),
      db.task.groupBy({ by: ["projectId", "status"], _count: { _all: true } }),
    ])
    const taskCount = (projectId: string, done?: boolean) =>
      tasks
        .filter((t) => t.projectId === projectId && (done === undefined || (t.status === "DONE") === done))
        .reduce((n, t) => n + t._count._all, 0)
    return {
      headers: ["Title", "Team", "Status", "Progress %", "Start", "Target", "Members", "Tasks done", "Tasks total", ...TECH_STACK_KEYS.map((k) => TECH_STACK_LABELS[k]), "Description"],
      rows: projects.map((p) => {
        const stack = parseTechStack(p.techStack)
        return [
          p.title, p.team?.name, STATUS_LABELS[p.status], p.progressPercent, p.startDate, p.targetDate,
          p._count.members, taskCount(p.id, true), taskCount(p.id), ...TECH_STACK_KEYS.map((k) => stack[k].join("; ")),
          p.description,
        ]
      }),
    }
  },

  async tasks() {
    const tasks = await db.task.findMany({
      orderBy: [{ project: { title: "asc" } }, { status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      include: { project: { select: { title: true } }, assignee: { select: { name: true } } },
    })
    return {
      headers: ["Project", "Title", "Status", "Priority", "Assignee", "Due", "Completed", "Description"],
      rows: tasks.map((t) => [
        t.project.title, t.title, TASK_STATUS[t.status], TASK_PRIORITY[t.priority], t.assignee?.name, t.dueDate,
        day(t.completedAt), t.description,
      ]),
    }
  },
}
