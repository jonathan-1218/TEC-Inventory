"use server"

import { db } from "@/lib/db"
import { ActionError, projectAction } from "@/lib/action"
import { portalMemberRoleSchema, portalProjectSchema, portalTeamSchema } from "@/lib/validators"

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
