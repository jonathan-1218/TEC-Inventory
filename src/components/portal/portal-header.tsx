"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ListChecks, LogOut, PackageOpen, Rocket, Settings, TrendingUp } from "lucide-react"
import { useTheme } from "next-themes"
import SwitchButton from "@/components/ui/switch-button"
import { Button } from "@/components/ui/button"
import { TecLogo } from "@/components/tec-logo"
import { logout } from "@/app/actions/auth"
import { runAction } from "@/lib/client"
import { showOverlay } from "@/lib/overlay"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/team", label: "Overview", icon: Rocket },
  { href: "/team/tasks", label: "Tasks", icon: ListChecks },
  { href: "/team/updates", label: "Progress", icon: TrendingUp },
  { href: "/team/parts", label: "Parts", icon: PackageOpen },
  { href: "/team/settings", label: "Settings", icon: Settings },
]

/** The project-team portal's top bar: its own navigation, no club sidebar. */
export function PortalHeader({ team }: { team: { projectTitle: string } | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [pending, start] = useTransition()
  const active = (href: string) => (href === "/team" ? pathname === "/team" : pathname.startsWith(href))

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
        <Link href={team ? "/team" : "/team/login"} aria-label="TEC project teams" className="flex shrink-0 items-center gap-3">
          <TecLogo height={26} />
          <span className="eyebrow border-l pl-3 max-sm:hidden">Project teams</span>
        </Link>

        {team && (
          <nav aria-label="Portal" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
                  active(href) ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" /> {label}
              </Link>
            ))}
          </nav>
        )}

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

      {/* Phones: the same navigation as a scrolling pill bar under the header. */}
      {team && (
        <nav aria-label="Portal" className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                active(href) ? "bg-foreground text-background" : "text-muted-foreground bg-muted/60"
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
