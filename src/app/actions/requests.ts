"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { ActionError, adminAction, errorMessage, type ActionResult } from "@/lib/action"
import { todayNoonUTC } from "@/lib/dates"
import { issue } from "@/lib/stock"
import { MINUTE, allowAll, clientIp } from "@/lib/throttle"
import { componentRequestSchema, idSchema, type IssueInput } from "@/lib/validators"

const LOAN_DAYS = 14
const MAX_PENDING = 300

/** Public: a student asks for a component. Nothing is issued until an admin approves it. */
export async function requestComponent(raw: Record<string, string>): Promise<ActionResult> {
  const parsed = componentRequestSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".") || "_form"] ??= []).push(i.message)
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors }
  }
  const ip = await clientIp()
  if (!(await allowAll([[`request:ip:${ip}`, 5, 60 * MINUTE], ["request:all", 100, 60 * MINUTE]]))) {
    return { ok: false, error: "Too many requests right now. Please try again later." }
  }
  try {
    const d = parsed.data
    if (!(await db.component.findUnique({ where: { id: d.componentId }, select: { id: true } }))) {
      return { ok: false, error: "Pick a component from the list." }
    }
    if ((await db.componentRequest.count()) >= MAX_PENDING) {
      return { ok: false, error: "The request list is full. Please ask a club officer." }
    }
    if (await db.componentRequest.count({ where: { rollNumber: d.rollNumber, componentId: d.componentId } })) {
      return { ok: false, error: "You've already requested this component. An officer will get back to you." }
    }
    await db.componentRequest.create({ data: d })
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
  revalidatePath("/issuances")
  return { ok: true, data: undefined }
}

/** Admin: issue the requested units for 14 days (adding the student as a member if the roll number is new). */
export const approveRequest = adminAction(idSchema, async ({ id }) => {
  return db.$transaction(
    async (tx) => {
      const r = await tx.componentRequest.findUnique({ where: { id } })
      if (!r) throw new ActionError("This request no longer exists.")
      const member =
        (await tx.member.findUnique({ where: { rollNumber: r.rollNumber } })) ??
        (await tx.member.create({
          data: { name: r.name, rollNumber: r.rollNumber, department: r.department, yearOfStudy: r.yearOfStudy },
        }))
      const issued = todayNoonUTC()
      const input: IssueInput = {
        componentId: r.componentId,
        quantity: r.quantity,
        issuedToMemberId: member.id,
        projectId: null,
        issuedDate: issued,
        expectedReturnDate: new Date(issued.getTime() + LOAN_DAYS * 86_400_000),
        notes: "Requested online",
      }
      await issue(tx, input)
      await tx.componentRequest.delete({ where: { id } })
      return { id }
    },
    { isolationLevel: "Serializable" }
  )
})

export const rejectRequest = adminAction(idSchema, async ({ id }) => {
  await db.componentRequest.deleteMany({ where: { id } })
  return { id }
})
