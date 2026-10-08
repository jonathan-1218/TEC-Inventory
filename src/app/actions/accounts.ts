"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, adminAction, errorMessage, type ActionResult } from "@/lib/action"
import { TEAM_COOKIE, hashPassword, sessionValue, verifyPassword } from "@/lib/team-auth"
import { fixedWindow } from "@/lib/throttle"
import {
  idSchema,
  mentorSchema,
  signupSchema,
  storedSignupSchema,
  teamLoginSchema,
  type SignupInput,
} from "@/lib/validators"

const signupThrottle = fixedWindow(10) // sign-ups per minute, all visitors together
const loginThrottle = fixedWindow(20)
// Compared against when the email is unknown, so a miss costs the same time as a wrong password.
const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(64)

/** Public: queue a team sign-up for admin approval. Nothing is created in the club's data until then. */
export async function signUp(raw: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message }
  }
  if (!signupThrottle.take()) return { ok: false, error: "Too many sign-ups right now. Please try again in a minute." }
  const { email, password, ...signup } = parsed.data
  try {
    const mentor = await db.mentor.findUnique({ where: { id: signup.mentorId }, select: { id: true } })
    if (!mentor) return { ok: false, error: "Pick a mentor from the list." }
    if (await db.account.findUnique({ where: { email }, select: { id: true } })) {
      return { ok: false, error: "An account with this email already exists." }
    }
    await db.account.create({ data: { email, passwordHash: await hashPassword(password), signup } })
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
  revalidatePath("/accounts")
  return { ok: true, data: undefined }
}

export async function teamLogin(raw: { email: string; password: string }): Promise<ActionResult<{ projectId: string }>> {
  const parsed = teamLoginSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!loginThrottle.take()) return { ok: false, error: "Too many attempts. Please wait a minute and try again." }
  const account = await db.account.findUnique({ where: { email: parsed.data.email } })
  const ok = await verifyPassword(parsed.data.password, account?.passwordHash ?? DUMMY_HASH)
  if (!account || !ok) return { ok: false, error: "Wrong email or password." }
  if (!account.approvedAt || !account.projectId) {
    return { ok: false, error: "Your sign-up is waiting for an admin to approve it." }
  }
  const value = sessionValue(account.id, account.passwordHash)
  if (!value) return { ok: false, error: "Logins aren't set up on the server (ADMIN_PASSWORD missing)." }
  ;(await cookies()).set(TEAM_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  revalidatePath("/", "layout")
  return { ok: true, data: { projectId: account.projectId } }
}

/** Turns a pending sign-up into a Project with its Members (existing roll numbers are reused, not edited). */
export const approveAccount = adminAction(idSchema, async ({ id }) => {
  return db.$transaction(async (tx) => {
    const account = await tx.account.findUnique({ where: { id } })
    if (!account) throw new ActionError("This sign-up no longer exists.")
    if (account.approvedAt) throw new ActionError("Already approved.")
    const s = storedSignupSchema.parse(account.signup)
    const mentor = await tx.mentor.findUnique({ where: { id: s.mentorId }, select: { id: true } })

    const memberIds: string[] = []
    for (const [i, m] of s.members.entries()) {
      const existing = await tx.member.findUnique({ where: { rollNumber: m.rollNumber }, select: { id: true } })
      if (existing) {
        memberIds.push(existing.id)
        continue
      }
      // The lead gets the account email when no other member already uses it.
      const email =
        i === 0 && !(await tx.member.findUnique({ where: { email: account.email }, select: { id: true } }))
          ? account.email
          : null
      memberIds.push((await tx.member.create({ data: { ...m, email } })).id)
    }

    const project = await tx.project.create({
      data: {
        title: s.title,
        description: s.description,
        mentorId: mentor?.id ?? null,
        techStack: { languages: [], frameworks: [], hardware: [], tools: [], cloud: [] },
        status: "PLANNING",
        startDate: new Date(),
        members: {
          create: memberIds.map((memberId, i) => ({ memberId, roleInProject: i === 0 ? "Project Lead" : "Member" })),
        },
      },
    })
    await tx.account.update({ where: { id }, data: { approvedAt: new Date(), projectId: project.id } })
    return { projectId: project.id }
  })
})

/** Rejects a pending sign-up, or revokes an approved login (the project and its data stay). */
export const deleteAccount = adminAction(idSchema, async ({ id }) => {
  await db.account.delete({ where: { id } })
  return { id }
})

export const createMentor = adminAction(mentorSchema, async (data) => {
  const m = await db.mentor.create({ data })
  return { id: m.id }
})

export const updateMentor = adminAction(mentorSchema.extend({ id: z.string().min(1) }), async ({ id, ...data }) => {
  await db.mentor.update({ where: { id }, data })
  return { id }
})

export const deleteMentor = adminAction(idSchema, async ({ id }) => {
  // Projects keep going without a mentor (mentorId is set to null).
  await db.mentor.delete({ where: { id } })
  return { id }
})
