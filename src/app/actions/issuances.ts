"use server"

import { db } from "@/lib/db"
import { adminAction } from "@/lib/action"
import { extendDue, issue, returnUnits } from "@/lib/stock"
import { extendDueSchema, issueSchema, returnSchema } from "@/lib/validators"

export const issueComponent = adminAction(issueSchema, async (input) => {
  const iss = await db.$transaction((tx) => issue(tx, input), { isolationLevel: "Serializable" })
  return { id: iss.id }
})

export const returnIssuance = adminAction(returnSchema, async (input) => {
  return db.$transaction((tx) => returnUnits(tx, input), { isolationLevel: "Serializable" })
})

export const extendDueDate = adminAction(extendDueSchema, async (input) => {
  return db.$transaction((tx) => extendDue(tx, input))
})
