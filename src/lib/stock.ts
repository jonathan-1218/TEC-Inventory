import type { Prisma, PrismaClient } from "@prisma/client"
import { ActionError } from "@/lib/action-error"
import type { ExtendDueInput, IssueInput, ReturnInput } from "@/lib/validators"

type Tx = Prisma.TransactionClient | PrismaClient

/** Units of a component currently out on open (unreturned) issuances. */
export async function issuedCount(tx: Tx, componentId: string): Promise<number> {
  const agg = await tx.issuance.aggregate({
    where: { componentId, returnedDate: null },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

/** componentId -> units currently issued, for every component with open issuances. */
export async function issuedCounts(tx: Tx): Promise<Map<string, number>> {
  const rows = await tx.issuance.groupBy({
    by: ["componentId"],
    where: { returnedDate: null },
    _sum: { quantity: true },
  })
  return new Map(rows.map((r) => [r.componentId, r._sum.quantity ?? 0]))
}

/** Issue units to a member. Run inside a serializable transaction. */
export async function issue(tx: Tx, input: IssueInput) {
  const component = await tx.component.findUnique({ where: { id: input.componentId } })
  if (!component) throw new ActionError("Component not found.")

  const member = await tx.member.findUnique({ where: { id: input.issuedToMemberId } })
  if (!member) throw new ActionError("Member not found.")
  if (!member.isActive) throw new ActionError(`${member.name} is marked inactive.`)

  if (input.projectId) {
    const project = await tx.project.findUnique({ where: { id: input.projectId } })
    if (!project) throw new ActionError("Project not found.")
  }

  const available = component.quantityWorking - (await issuedCount(tx, component.id))
  if (input.quantity > available) {
    throw new ActionError(
      available <= 0
        ? `No working ${component.name} units are available.`
        : `Only ${available} ${component.name} unit(s) available.`
    )
  }

  if (input.projectId) {
    await tx.projectComponent.upsert({
      where: { projectId_componentId: { projectId: input.projectId, componentId: component.id } },
      create: {
        projectId: input.projectId,
        componentId: component.id,
        quantityRequired: input.quantity,
        quantityIssued: input.quantity,
      },
      update: { quantityIssued: { increment: input.quantity } },
    })
  }

  return tx.issuance.create({ data: input })
}

/**
 * Return some or all units of an open issuance.
 * Partial returns split the record: the open one keeps the remainder and a closed
 * record is created for the returned part, so mixed conditions = several returns.
 * Working -> back to available. Damaged -> moves working to damaged. Lost -> leaves inventory.
 */
export async function returnUnits(tx: Tx, input: ReturnInput) {
  const iss = await tx.issuance.findUnique({ where: { id: input.id } })
  if (!iss) throw new ActionError("Issuance not found.")
  if (iss.returnedDate) throw new ActionError("This issuance has already been returned.")
  if (input.quantity > iss.quantity) {
    throw new ActionError(`Only ${iss.quantity} unit(s) are out on this issuance.`)
  }
  if (input.returnedDate < iss.issuedDate) {
    throw new ActionError("Return date can't be before the issue date.")
  }

  const notes = input.notes
    ? [iss.notes, `Return: ${input.notes}`].filter(Boolean).join("\n")
    : iss.notes
  const closed = { returnedDate: input.returnedDate, conditionOnReturn: input.condition, notes }

  let closedId = iss.id
  if (input.quantity < iss.quantity) {
    await tx.issuance.update({ where: { id: iss.id }, data: { quantity: iss.quantity - input.quantity } })
    const part = await tx.issuance.create({
      data: {
        componentId: iss.componentId,
        issuedToMemberId: iss.issuedToMemberId,
        projectId: iss.projectId,
        issuedDate: iss.issuedDate,
        expectedReturnDate: iss.expectedReturnDate,
        quantity: input.quantity,
        ...closed,
      },
    })
    closedId = part.id
  } else {
    await tx.issuance.update({ where: { id: iss.id }, data: closed })
  }

  const q = input.quantity
  if (input.condition === "DAMAGED") {
    await tx.component.update({
      where: { id: iss.componentId },
      data: { quantityWorking: { decrement: q }, quantityDamaged: { increment: q } },
    })
  } else if (input.condition === "LOST") {
    await tx.component.update({
      where: { id: iss.componentId },
      data: { quantityWorking: { decrement: q }, quantityTotal: { decrement: q } },
    })
  }

  if (iss.projectId) {
    const pc = await tx.projectComponent.findUnique({
      where: { projectId_componentId: { projectId: iss.projectId, componentId: iss.componentId } },
    })
    if (pc) {
      await tx.projectComponent.update({
        where: { projectId_componentId: { projectId: iss.projectId, componentId: iss.componentId } },
        data: { quantityIssued: Math.max(0, pc.quantityIssued - q) },
      })
    }
  }

  return { id: closedId }
}

/** Move an open issuance's expected return date (the schema already rejects dates before today). */
export async function extendDue(tx: Tx, { id, expectedReturnDate }: ExtendDueInput) {
  const iss = await tx.issuance.findUnique({ where: { id } })
  if (!iss) throw new ActionError("Issuance not found.")
  if (iss.returnedDate) throw new ActionError("This issuance has already been returned.")
  if (expectedReturnDate < iss.issuedDate) throw new ActionError("Expected return can't be before the issue date.")
  await tx.issuance.update({ where: { id }, data: { expectedReturnDate } })
  return { id }
}
