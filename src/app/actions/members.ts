"use server"

import { db } from "@/lib/db"
import { ActionError, adminAction } from "@/lib/action"
import { idSchema, memberCreateSchema, memberUpdateSchema } from "@/lib/validators"

export const createMember = adminAction(memberCreateSchema, async (data) => {
  const m = await db.member.create({ data })
  return { id: m.id }
})

export const updateMember = adminAction(memberUpdateSchema, async ({ id, ...data }) => {
  await db.member.update({ where: { id }, data })
  return { id }
})

export const deleteMember = adminAction(idSchema, async ({ id }) => {
  const open = await db.issuance.count({ where: { issuedToMemberId: id, returnedDate: null } })
  if (open > 0) {
    throw new ActionError(
      `Can't delete: this member still has ${open} open issuance(s). Return them first, or mark the member inactive.`
    )
  }
  await db.member.delete({ where: { id } })
  return { id }
})
