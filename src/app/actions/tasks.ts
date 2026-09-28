"use server"

import { db } from "@/lib/db"
import { adminAction } from "@/lib/action"
import * as tasks from "@/lib/tasks"
import { idSchema, taskCreateSchema, taskDoneSchema, taskMoveSchema, taskUpdateSchema } from "@/lib/validators"

// adminAction revalidates every page on success, so project, dashboard and member pages all refresh.
const serializable = { isolationLevel: "Serializable" } as const

export const createTask = adminAction(taskCreateSchema, async (input) => {
  const t = await db.$transaction((tx) => tasks.createTask(tx, input), serializable)
  return { id: t.id }
})

export const updateTask = adminAction(taskUpdateSchema, async (input) => {
  const t = await db.$transaction((tx) => tasks.updateTask(tx, input), serializable)
  return { id: t.id }
})

export const deleteTask = adminAction(idSchema, async ({ id }) => {
  await db.task.delete({ where: { id } })
  return { id }
})

export const moveTask = adminAction(taskMoveSchema, async (input) => {
  return db.$transaction((tx) => tasks.moveTask(tx, input), serializable)
})

export const setTaskDone = adminAction(taskDoneSchema, async (input) => {
  return db.$transaction((tx) => tasks.setTaskDone(tx, input), serializable)
})
