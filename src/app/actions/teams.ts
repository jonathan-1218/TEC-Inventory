"use server"

import { db } from "@/lib/db"
import { adminAction } from "@/lib/action"
import {
  idSchema,
  teamCreateSchema,
  teamMemberRemoveSchema,
  teamMemberSchema,
  teamUpdateSchema,
} from "@/lib/validators"

export const createTeam = adminAction(teamCreateSchema, async (data) => {
  const t = await db.team.create({ data })
  return { id: t.id }
})

export const updateTeam = adminAction(teamUpdateSchema, async ({ id, ...data }) => {
  await db.team.update({ where: { id }, data })
  return { id }
})

export const deleteTeam = adminAction(idSchema, async ({ id }) => {
  // Projects keep existing with teamId = null (onDelete: SetNull).
  await db.team.delete({ where: { id } })
  return { id }
})

/** Adds a member to a team, or updates their role if already on it. */
export const upsertTeamMember = adminAction(teamMemberSchema, async ({ teamId, memberId, roleInTeam }) => {
  await db.teamMember.upsert({
    where: { teamId_memberId: { teamId, memberId } },
    create: { teamId, memberId, roleInTeam },
    update: { roleInTeam },
  })
  return { teamId, memberId }
})

export const removeTeamMember = adminAction(teamMemberRemoveSchema, async ({ teamId, memberId }) => {
  await db.teamMember.delete({ where: { teamId_memberId: { teamId, memberId } } })
  return { teamId, memberId }
})
