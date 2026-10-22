"use client"

import { createContext, useContext, useTransition } from "react"
import { useRouter } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { runAction } from "@/lib/client"
import { showOverlay } from "@/lib/overlay"

const AdminContext = createContext(false)
export type TeamInfo = { projectId: string; projectTitle: string } | null
const TeamContext = createContext<TeamInfo>(null)

/**
 * `isAdmin` gates write controls. Nest a second provider with `isAdmin` = "may edit this project"
 * to open a project's own controls (tasks, progress) to its signed-in team.
 */
export function AdminProvider({
  isAdmin,
  team,
  children,
}: {
  isAdmin: boolean
  team?: TeamInfo
  children: React.ReactNode
}) {
  const inner = <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>
  return team === undefined ? inner : <TeamContext.Provider value={team}>{inner}</TeamContext.Provider>
}

/** The signed-in project team, if any. */
export function useTeam() {
  return useContext(TeamContext)
}

/** True when the viewer is logged in as admin. Use it to hide write controls. */
export function useIsAdmin() {
  return useContext(AdminContext)
}

/** Renders children only for admins. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return useIsAdmin() ? <>{children}</> : null
}

/** [pending, logOut] — shared by the header and the sidebar footer. */
export function useLogout() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const logOut = () =>
    startTransition(async () => {
      showOverlay("Logging out…", 1500) // the page stays put, so this just covers the refresh
      await runAction(logout(), "Logged out")
      router.refresh()
    })
  return [pending, logOut] as const
}
