"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import SwitchButton from "@/components/ui/switch-button"
import { Button } from "@/components/ui/button"
import { TecLogo } from "@/components/tec-logo"
import { logout } from "@/app/actions/auth"
import { runAction } from "@/lib/client"
import { showOverlay } from "@/lib/overlay"
import { MorphicNavbar } from "@/components/ui/split-nav"

const NAV = {
  "/team": { name: "Overview" },
  "/team/tasks": { name: "Tasks" },
  "/team/updates": { name: "Progress" },
  "/team/parts": { name: "Parts" },
  "/team/settings": { name: "Settings" },
}

/** The project-team portal's top bar: its own navigation, no club sidebar. */
export function PortalHeader({ team }: { team: { projectTitle: string } | null }) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [pending, start] = useTransition()

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
        <Link href={team ? "/team" : "/team/login"} aria-label="TEC project teams" className="flex shrink-0 items-center gap-3">
          <TecLogo height={26} />
          <span className="eyebrow border-l pl-3 max-sm:hidden">Project teams</span>
        </Link>

        {team && <MorphicNavbar items={NAV} className="ml-2 p-0 max-md:hidden" />}

        <div className="ml-auto flex items-center gap-1.5">
          <SwitchButton size="sm" showLabel={false} theme={resolvedTheme === "dark" ? "dark" : "light"} onThemeChange={setTheme} />
                    {team && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  showOverlay("Logging out…")
                  await runAction(logout(), "Logged out")
                  router.replace("/team/login")
                  router.refresh()
                })
              }
            >
              <LogOut />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          )}
        </div>
      </div>

      {/* Phones: the same navigation in its own row under the header, scrolling sideways if it doesn't fit. */}
      {team && (
        <div className="overflow-x-auto border-t md:hidden">
          <MorphicNavbar items={NAV} className="w-max min-w-full px-3" />
        </div>
      )}
    </header>
  )
}
