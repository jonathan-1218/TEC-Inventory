"use server"

import { db } from "@/lib/db"
import { adminAction } from "@/lib/action"
import { issue, returnUnits } from "@/lib/stock"
import { issueSchema, returnSchema } from "@/lib/validators"

export const issueComponent = adminAction(issueSchema, async (input) => {
  const iss = await db.$transaction((tx) => issue(tx, input), { isolationLevel: "Serializable" })
  return { id: iss.id }
})

export const returnIssuance = adminAction(returnSchema, async (input) => {
  return db.$transaction((tx) => returnUnits(tx, input), { isolationLevel: "Serializable" })
})
