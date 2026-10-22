"use client"

import { createContext, useContext, useMemo } from "react"
import type { DesignationOpt } from "@/lib/designations"

const Ctx = createContext<DesignationOpt[]>([])

/** The club's designations, loaded once by the layout, so any client component can show labels and offer choices. */
export function DesignationsProvider({ designations, children }: { designations: DesignationOpt[]; children: React.ReactNode }) {
  return <Ctx.Provider value={designations}>{children}</Ctx.Provider>
}

export function useDesignations() {
  const list = useContext(Ctx)
  return useMemo(() => {
    const byId = new Map(list.map((d) => [d.id, d]))
    return {
      list,
      get: (id: string) => byId.get(id),
      label: (id: string) => byId.get(id)?.label ?? id,
      rank: (id: string) => byId.get(id)?.rank ?? 9999,
      tier: (id: string) => byId.get(id)?.tier ?? "MEMBER",
    }
  }, [list])
}
