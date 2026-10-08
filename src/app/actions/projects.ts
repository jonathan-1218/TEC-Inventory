"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import type { Prisma, ProjectStatus } from "@prisma/client"
import { ActionError, adminAction, projectAction } from "@/lib/action"
import { STATUSES } from "@/lib/labels"
import {
  goalSchema,
  idSchema,
  progressUpdateSchema,
  projectComponentRemoveSchema,
  projectComponentSchema,
  projectCreateSchema,
  projectMemberRemoveSchema,
  projectMemberSchema,
  projectUpdateSchema,
} from "@/lib/validators"

export const createProject = adminAction(projectCreateSchema, async (data) => {
  const p = await db.project.create({ data })
  return { id: p.id }
})

export const updateProject = adminAction(projectUpdateSchema, async ({ id, ...data }) => {
  await db.project.update({ where: { id }, data })
  return { id }
})

/** Board drag: change only the status. */
export const updateProjectStatus = adminAction(
  z.object({ id: z.string().min(1), status: z.enum(STATUSES as [ProjectStatus, ...ProjectStatus[]]) }),
  async ({ id, status }) => {
    await db.project.update({ where: { id }, data: { status } })
    return { id, status }
  }
)

export const deleteProject = adminAction(idSchema, async ({ id }) => {
  // Members, updates and component requirements cascade; issuances keep their history with projectId = null.
  await db.project.delete({ where: { id } })
  return { id }
})

/** Adds a member to a project, or updates their role if already on it. */
export const upsertProjectMember = adminAction(
  projectMemberSchema,
  async ({ projectId, memberId, roleInProject }) => {
    await db.projectMember.upsert({
      where: { projectId_memberId: { projectId, memberId } },
      create: { projectId, memberId, roleInProject },
      update: { roleInProject },
    })
    return { projectId, memberId }
  }
)

export const removeProjectMember = adminAction(
  projectMemberRemoveSchema,
  async ({ projectId, memberId }) => {
    await db.projectMember.delete({ where: { projectId_memberId: { projectId, memberId } } })
    return { projectId, memberId }
  }
)

/** Sets how many units of a component a project needs (adds the requirement if missing). */
export const upsertProjectComponent = adminAction(
  projectComponentSchema,
  async ({ projectId, componentId, quantityRequired }) => {
    await db.projectComponent.upsert({
      where: { projectId_componentId: { projectId, componentId } },
      create: { projectId, componentId, quantityRequired },
      update: { quantityRequired },
    })
    return { projectId, componentId }
  }
)

export const removeProjectComponent = adminAction(
  projectComponentRemoveSchema,
  async ({ projectId, componentId }) => {
    const where = { projectId_componentId: { projectId, componentId } }
    const pc = await db.projectComponent.findUnique({ where })
    if (pc && pc.quantityIssued > 0) {
      throw new ActionError(
        `${pc.quantityIssued} unit(s) are still issued for this project. Return them before removing the requirement.`
      )
    }
    await db.projectComponent.delete({ where })
    return { projectId, componentId }
  }
)

/** Project progress always mirrors its latest update (by date); 0 when no updates remain. */
async function syncProgress(tx: Prisma.TransactionClient, projectId: string) {
  const latest = await tx.progressUpdate.findFirst({
    where: { projectId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })
  // Deleting the last update must not leave a stale percent — reset to 0 so progress never lies.
  await tx.project.update({
    where: { id: projectId },
    data: { progressPercent: latest?.percentAtUpdate ?? 0 },
  })
}

export const addProgressUpdate = projectAction(progressUpdateSchema, async (d) => d.projectId, async (data) => {
  return db.$transaction(async (tx) => {
    const u = await tx.progressUpdate.create({ data })
    await syncProgress(tx, data.projectId)
    return { id: u.id }
  })
})

export const deleteProgressUpdate = projectAction(
  idSchema,
  async ({ id }) => (await db.progressUpdate.findUnique({ where: { id }, select: { projectId: true } }))?.projectId,
  async ({ id }) => {
    return db.$transaction(async (tx) => {
      const u = await tx.progressUpdate.delete({ where: { id } })
      await syncProgress(tx, u.projectId)
      return { id }
    })
  }
)

/** Admin: this project's own goal (blank both to fall back to the club-wide goal). */
export const setProjectGoal = adminAction(
  z.object({ id: z.string().min(1) }).and(goalSchema),
  async ({ id, goalPercent, goalDate }) => {
    await db.project.update({ where: { id }, data: { goalPercent, goalDate } })
    return { id }
  }
)

/** Admin: the club-wide goal every project without its own goal is measured against. */
export const setClubGoal = adminAction(goalSchema, async ({ goalPercent, goalDate }) => {
  await db.clubSettings.upsert({ where: { id: "club" }, create: { goalPercent, goalDate }, update: { goalPercent, goalDate } })
  return { id: "club" }
})
