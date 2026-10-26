"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, adminAction, errorMessage, type ActionResult } from "@/lib/action"
import { TEAM_COOKIE, hashPassword, sessionValue, teamSession, verifyPassword } from "@/lib/team-auth"
import { MINUTE, allowAll, clearLimit, clientIp } from "@/lib/throttle"
import { passwordProblems } from "@/lib/password-strength"
import {
  changePasswordSchema,
  idSchema,
  mentorSchema,
  personalWords,
  resetPasswordSchema,
  signupSchema,
  storedSignupSchema,
  teamLoginSchema,
  type SignupInput,
} from "@/lib/validators"

// Compared against when the email is unknown, so a miss costs the same time as a wrong password.
const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(64)

/** Public: queue a team sign-up for admin approval. Nothing is created in the club's data until then. */
export async function signUp(raw: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message }
  }
  const ip = await clientIp()
  if (!(await allowAll([[`signup:ip:${ip}`, 5, 60 * MINUTE], ["signup:all", 60, 60 * MINUTE]]))) {
    return { ok: false, error: "Too many sign-ups right now. Please try again later." }
  }
  const { email, password, ...signup } = parsed.data
  try {
    const mentor = await db.mentor.findUnique({ where: { id: signup.mentorId }, select: { id: true } })
    if (!mentor) return { ok: false, error: "Pick a mentor from the list." }
    if (!signup.teamName) return { ok: false, error: "Give your team a name." }
    if (await db.team.findFirst({ where: { name: { equals: signup.teamName, mode: "insensitive" } }, select: { id: true } })) {
      return { ok: false, error: "A team with this name already exists. Pick another name." }
    }
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
  // Per account (stops guessing one team's password from many IPs) and per IP (stops spraying many accounts).
  const ip = await clientIp()
  const emailKey = `team-login:email:${parsed.data.email}`
  if (!(await allowAll([[emailKey, 5, 15 * MINUTE], [`team-login:ip:${ip}`, 20, 15 * MINUTE]]))) {
    return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." }
  }
  const account = await db.account.findUnique({ where: { email: parsed.data.email } })
  const ok = await verifyPassword(parsed.data.password, account?.passwordHash ?? DUMMY_HASH)
  if (!account || !ok) return { ok: false, error: "Wrong email or password." }
  await clearLimit(emailKey)
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

/**
 * A signed-in team changes its own password (current one required). Sessions are bound to the password hash, so
 * the old sessions on other devices end and this browser is given a fresh cookie.
 */
export async function changeOwnPassword(raw: { current: string; password: string }): Promise<ActionResult> {
  const team = await teamSession()
  if (!team) return { ok: false, error: "Please log in again." }
  const parsed = changePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue.message, fieldErrors: { [String(issue.path[0] ?? "current")]: [issue.message] } }
  }
  // Counted before the current password is checked, so this form can't be used to guess it.
  const key = `team-pw:${team.accountId}`
  if (!(await allowAll([[key, 5, 15 * MINUTE]]))) return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." }
  const account = await db.account.findUnique({ where: { id: team.accountId }, select: { passwordHash: true, signup: true, email: true } })
  if (!account || !(await verifyPassword(parsed.data.current, account.passwordHash))) {
    return { ok: false, error: "That isn't your current password.", fieldErrors: { current: ["That isn't your current password."] } }
  }
  if (parsed.data.password === parsed.data.current) {
    return { ok: false, error: "Choose a different password.", fieldErrors: { password: ["Choose a different password."] } }
  }
  const stored = storedSignupSchema.safeParse(account.signup)
  const problem = passwordProblems(parsed.data.password, personalWords(account.email, stored.success ? stored.data.members : []))[0]
  if (problem) return { ok: false, error: problem, fieldErrors: { password: [problem] } }

  const passwordHash = await hashPassword(parsed.data.password)
  await db.account.update({ where: { id: team.accountId }, data: { passwordHash } })
  await clearLimit(key)
  const value = sessionValue(team.accountId, passwordHash)
  if (value) {
    ;(await cookies()).set(TEAM_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}

/** Turns a pending sign-up into a Project with its Members (existing register numbers are reused, not edited). */
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

    // Every approved sign-up gets its own team: the head leads it, everyone on the sign-up is a member.
    const teamName = s.teamName ?? `${s.title} team`
    if (await tx.team.findFirst({ where: { name: { equals: teamName, mode: "insensitive" } }, select: { id: true } })) {
      throw new ActionError(`A team called “${teamName}” already exists. Rename that team first, or reject this sign-up.`)
    }
    const team = await tx.team.create({
      data: {
        name: teamName,
        members: { create: memberIds.map((memberId, i) => ({ memberId, roleInTeam: i === 0 ? "Team Lead" : "Member" })) },
      },
    })

    const project = await tx.project.create({
      data: {
        teamId: team.id,
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

/**
 * Admin: set a new password for a team's login (a forgotten password). Same strength rules as sign-up; the old
 * password and every open session stop working (the session cookie is bound to the password hash), and any
 * login lockout is lifted.
 */
export const resetTeamPassword = adminAction(resetPasswordSchema, async ({ id, password }) => {
  const account = await db.account.findUnique({ where: { id }, select: { email: true, signup: true } })
  if (!account) throw new ActionError("This login no longer exists.")
  const s = storedSignupSchema.safeParse(account.signup)
  const problem = passwordProblems(password, personalWords(account.email, s.success ? s.data.members : []))[0]
  if (problem) throw new ActionError(problem)
  await db.account.update({ where: { id }, data: { passwordHash: await hashPassword(password) } })
  await clearLimit(`team-login:email:${account.email}`)
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
