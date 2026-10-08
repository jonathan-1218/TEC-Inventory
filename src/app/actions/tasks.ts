"use server"

import { db } from "@/lib/db"
import { projectAction } from "@/lib/action"
import * as tasks from "@/lib/tasks"
import { idSchema, taskCreateSchema, taskDoneSchema, taskMoveSchema, taskUpdateSchema } from "@/lib/validators"

// projectAction revalidates every page on success, so project, dashboard and member pages all refresh.
const serializable = { isolationLevel: "Serializable" } as const
// Teams may edit tasks on their own project only; id-only inputs resolve the project from the row.
const byInput = async (i: { projectId: string }) => i.projectId
const byTask = async (i: { id: string }) =>
  (await db.task.findUnique({ where: { id: i.id }, select: { projectId: true } }))?.projectId

export const createTask = projectAction(taskCreateSchema, byInput, async (input) => {
  const t = await db.$transaction((tx) => tasks.createTask(tx, input), serializable)
  return { id: t.id }
})

export const updateTask = projectAction(taskUpdateSchema, byTask, async (input) => {
  const t = await db.$transaction((tx) => tasks.updateTask(tx, input), serializable)
  return { id: t.id }
})

export const deleteTask = projectAction(idSchema, byTask, async ({ id }) => {
  await db.task.delete({ where: { id } })
  return { id }
})

export const moveTask = projectAction(taskMoveSchema, byTask, async (input) => {
  return db.$transaction((tx) => tasks.moveTask(tx, input), serializable)
})

export const setTaskDone = projectAction(taskDoneSchema, byTask, async (input) => {
  return db.$transaction((tx) => tasks.setTaskDone(tx, input), serializable)
})
