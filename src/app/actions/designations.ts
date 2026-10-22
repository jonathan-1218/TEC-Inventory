"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, adminAction } from "@/lib/action"
import { designationSchema, idSchema } from "@/lib/validators"

// Unique labels, ignoring capitals, so "president" and "President" can't both exist.
async function assertLabelFree(label: string, exceptId?: string) {
  const clash = await db.designationOption.findFirst({
    where: { label: { equals: label, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  if (clash) throw new ActionError(`A designation called “${label}” already exists.`)
}

export const createDesignation = adminAction(designationSchema, async (data) => {
  await assertLabelFree(data.label)
  const d = await db.designationOption.create({ data })
  return { id: d.id }
})

export const updateDesignation = adminAction(designationSchema.extend({ id: z.string().min(1) }), async ({ id, ...data }) => {
  await assertLabelFree(data.label, id)
  await db.designationOption.update({ where: { id }, data })
  return { id }
})

export const deleteDesignation = adminAction(idSchema, async ({ id }) => {
  // New members (including approved team sign-ups) get this one by default.
  if (id === "MEMBER") throw new ActionError("“Member” is the default designation and can't be removed. You can rename it.")
  const users = await db.member.count({ where: { designation: id } })
  if (users > 0) {
    throw new ActionError(`${users} member${users === 1 ? " has" : "s have"} this designation. Change their designation first.`)
  }
  if ((await db.designationOption.count()) <= 1) throw new ActionError("Keep at least one designation.")
  await db.designationOption.delete({ where: { id } })
  return { id }
})
