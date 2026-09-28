"use client"

import { createContext, useContext, useTransition } from "react"
import { useRouter } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { runAction } from "@/lib/client"

const AdminContext = createContext(false)

export function AdminProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>
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
      await runAction(logout(), "Logged out")
      router.refresh()
    })
  return [pending, logOut] as const
}
