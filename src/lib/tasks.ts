import type { Prisma, PrismaClient, TaskStatus } from "@prisma/client"
import { ActionError } from "@/lib/action-error"
import type { TaskCreateInput, TaskMoveInput, TaskUpdateInput } from "@/lib/validators"

type Tx = Prisma.TransactionClient | PrismaClient

// Tasks sort by (status column, order, createdAt). Moves renumber the target column 0..n-1;
// the column a task leaves may keep a gap, which sorts the same.

/** completedAt follows status: stamped when a task becomes DONE, cleared when it leaves DONE, kept otherwise. */
export function completedAtFor(
  prev: { status: TaskStatus; completedAt: Date | null } | null,
  next: TaskStatus,
  now = new Date()
): Date | null {
  if (next !== "DONE") return null
  return prev?.status === "DONE" ? (prev.completedAt ?? now) : now
}

async function nextOrder(tx: Tx, projectId: string, status: TaskStatus): Promise<number> {
  const agg = await tx.task.aggregate({ where: { projectId, status }, _max: { order: true } })
  return (agg._max.order ?? -1) + 1
}

async function checkAssignee(tx: Tx, assigneeId: string | null | undefined) {
  if (assigneeId && !(await tx.member.findUnique({ where: { id: assigneeId }, select: { id: true } }))) {
    throw new ActionError("Assignee not found.")
  }
}

/** New tasks go to the end of their column. */
export async function createTask(tx: Tx, input: TaskCreateInput) {
  if (!(await tx.project.findUnique({ where: { id: input.projectId }, select: { id: true } }))) {
    throw new ActionError("Project not found.")
  }
  await checkAssignee(tx, input.assigneeId)
  return tx.task.create({
    data: {
      ...input,
      order: await nextOrder(tx, input.projectId, input.status),
      completedAt: completedAtFor(null, input.status),
    },
  })
}

/** Changing status here moves the task to the end of its new column. */
export async function updateTask(tx: Tx, { id, ...data }: TaskUpdateInput) {
  const task = await tx.task.findUnique({ where: { id } })
  if (!task) throw new ActionError("Task not found.")
  await checkAssignee(tx, data.assigneeId)
  const moving = data.status !== undefined && data.status !== task.status
  return tx.task.update({
    where: { id },
    data: moving
      ? {
          ...data,
          order: await nextOrder(tx, task.projectId, data.status!),
          completedAt: completedAtFor(task, data.status!),
        }
      : data,
  })
}

/** Kanban drop: put the task at `order` (clamped) in the `status` column and renumber that column. */
export async function moveTask(tx: Tx, { id, status, order }: TaskMoveInput) {
  const task = await tx.task.findUnique({ where: { id } })
  if (!task) throw new ActionError("Task not found.")
  const siblings = await tx.task.findMany({
    where: { projectId: task.projectId, status, id: { not: id } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  })
  const at = Math.max(0, Math.min(order, siblings.length))
  const ids = siblings.map((s) => s.id)
  ids.splice(at, 0, id)

  await tx.task.update({ where: { id }, data: { status, order: at, completedAt: completedAtFor(task, status) } })
  // One statement for the whole column (one round trip, however many cards moved).
  await tx.$executeRaw`UPDATE "Task" SET "order" = array_position(${ids}::text[], "id") - 1 WHERE "id" = ANY(${ids}::text[])`
  return { id, status, order: at }
}

/** Checklist tick: done -> end of DONE, undone -> end of TODO. No-op if already there. */
export async function setTaskDone(tx: Tx, { id, done }: { id: string; done: boolean }) {
  const task = await tx.task.findUnique({ where: { id }, select: { status: true } })
  if (!task) throw new ActionError("Task not found.")
  if ((task.status === "DONE") === done) return { id, status: task.status }
  const status: TaskStatus = done ? "DONE" : "TODO"
  await moveTask(tx, { id, status, order: Number.MAX_SAFE_INTEGER })
  return { id, status }
}
