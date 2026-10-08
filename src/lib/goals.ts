import { db } from "@/lib/db"

/** How many points below the expected pace a project may be before it's flagged. */
export const GOAL_TOLERANCE = 10
const DAY = 86_400_000

export type Goal = { percent: number; date: Date; source: "project" | "club" }
export type GoalStatus = Goal & { expected: number; behindBy: number; behind: boolean; missed: boolean }

export const getClubGoal = async () => db.clubSettings.findUnique({ where: { id: "club" } })

/** The project's own goal, else the club-wide one, else none. */
export function goalFor(
  p: { goalPercent: number | null; goalDate: Date | null },
  club: { goalPercent: number | null; goalDate: Date | null } | null
): Goal | null {
  if (p.goalPercent != null && p.goalDate) return { percent: p.goalPercent, date: p.goalDate, source: "project" }
  if (club?.goalPercent != null && club.goalDate) return { percent: club.goalPercent, date: club.goalDate, source: "club" }
  return null
}

/**
 * Expected progress grows in a straight line from 0% at the project's start to the goal on its date.
 * ponytail: linear pace is a naive heuristic; per-milestone goals if teams outgrow it.
 */
export function goalStatus(
  p: { progressPercent: number; startDate: Date | null; createdAt: Date; status: string },
  goal: Goal | null,
  now = new Date()
): GoalStatus | null {
  if (!goal || p.status === "COMPLETED" || p.status === "DROPPED") return null
  const start = (p.startDate ?? p.createdAt).getTime()
  const span = Math.max(DAY, goal.date.getTime() - start)
  const share = Math.min(1, Math.max(0, (now.getTime() - start) / span))
  const expected = Math.round(goal.percent * share)
  const behindBy = expected - p.progressPercent
  const missed = now >= goal.date && p.progressPercent < goal.percent
  return { ...goal, expected, behindBy, missed, behind: missed || behindBy > GOAL_TOLERANCE }
}
