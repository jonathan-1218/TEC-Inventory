"use client"

import { createContext, useContext } from "react"

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
