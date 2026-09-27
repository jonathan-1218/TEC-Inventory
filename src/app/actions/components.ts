"use server"

import { db } from "@/lib/db"
import { ActionError, adminAction } from "@/lib/action"
import { issuedCount } from "@/lib/stock"
import { componentCreateSchema, componentUpdateSchema, idSchema } from "@/lib/validators"

export const createComponent = adminAction(componentCreateSchema, async (data) => {
  const c = await db.component.create({ data })
  return { id: c.id }
})

export const updateComponent = adminAction(componentUpdateSchema, async ({ id, ...data }) => {
  return db.$transaction(
    async (tx) => {
      const issued = await issuedCount(tx, id)
      if (data.quantityWorking < issued) {
        throw new ActionError(
          `${issued} unit(s) are currently issued, so working quantity can't be below ${issued}.`
        )
      }
      await tx.component.update({ where: { id }, data })
      return { id }
    },
    { isolationLevel: "Serializable" }
  )
})

export const deleteComponent = adminAction(idSchema, async ({ id }) => {
  const open = await db.issuance.count({ where: { componentId: id, returnedDate: null } })
  if (open > 0) {
    throw new ActionError(
      `Can't delete: ${open} open issuance(s) for this component. Return them first.`
    )
  }
  await db.component.delete({ where: { id } })
  return { id }
})
