"use server"

import { db } from "@/lib/db"
import { ActionError, projectAction } from "@/lib/action"
import { idSchema, portalMemberRoleSchema, portalPartRequestSchema, portalProjectSchema, portalTeamSchema } from "@/lib/validators"

// Every action here is `projectAction`: it runs only for an admin, or for the signed-in team whose own project
// the input names (checked against the session, never trusted from the browser).
const ownProject = async (i: { projectId: string }) => i.projectId

/** Project details a team lead may edit. Progress, goal, mentor and members stay with the admins (or the progress log). */
export const updateOwnProject = projectAction(portalProjectSchema, ownProject, async ({ projectId, ...data }) => {
  await db.project.update({ where: { id: projectId }, data })
  return { projectId }
})

export const updateOwnTeam = projectAction(portalTeamSchema, ownProject, async ({ projectId, name, description }) => {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { teamId: true } })
  if (!project?.teamId) throw new ActionError("This project isn't part of a team yet. Ask a club admin.")
  const clash = await db.team.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: project.teamId } },
    select: { id: true },
  })
  if (clash) throw new ActionError("A team with this name already exists. Pick another name.")
  await db.team.update({ where: { id: project.teamId }, data: { name, description } })
  return { projectId }
})

/** A member's role on the project (e.g. "Firmware"). Adding or removing people is an admin job. */
export const updateOwnMemberRole = projectAction(portalMemberRoleSchema, ownProject, async ({ projectId, memberId, roleInProject }) => {
  const r = await db.projectMember.updateMany({ where: { projectId, memberId }, data: { roleInProject } })
  if (r.count === 0) throw new ActionError("That person isn't on this project.")
  return { projectId, memberId }
})

const MAX_OPEN_REQUESTS = 20

/** Ask the club for a part. An admin approves it on the Issuances page, which issues it to that member for this project. */
export const requestOwnPart = projectAction(portalPartRequestSchema, ownProject, async ({ projectId, memberId, componentId, quantity }) => {
  const pm = await db.projectMember.findUnique({
    where: { projectId_memberId: { projectId, memberId } },
    select: { member: { select: { name: true, rollNumber: true, department: true, yearOfStudy: true } } },
  })
  if (!pm) throw new ActionError("Pick someone on your project.")
  if (!(await db.component.findUnique({ where: { id: componentId }, select: { id: true } }))) throw new ActionError("Pick a component from the list.")
  const waiting = await db.componentRequest.findMany({ where: { projectId, rejectedAt: null }, select: { componentId: true } })
  if (waiting.some((w) => w.componentId === componentId)) throw new ActionError("Your team has already asked for this part. Wait for the answer first.")
  if (waiting.length >= MAX_OPEN_REQUESTS) throw new ActionError("Your team has too many requests waiting. Ask a club admin.")
  await db.componentRequest.create({ data: { ...pm.member, componentId, quantity, projectId } })
  return { projectId }
})

/** Cancel a waiting request, or dismiss a declined one. */
export const removeOwnRequest = projectAction(
  idSchema,
  async ({ id }) => (await db.componentRequest.findUnique({ where: { id }, select: { projectId: true } }))?.projectId,
  async ({ id }) => {
    await db.componentRequest.deleteMany({ where: { id } })
    return { id }
  }
)
