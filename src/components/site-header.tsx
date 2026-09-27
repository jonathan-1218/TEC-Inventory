"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { LogIn, LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { useIsAdmin } from "@/components/admin-context"
import { logout } from "@/app/actions/auth"
import { runAction } from "@/lib/client"

export function SiteHeader() {
  const admin = useIsAdmin()
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [pending, startTransition] = useTransition()

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        {admin ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await runAction(logout(), "Logged out")
                router.refresh()
              })
            }
          >
            <LogOut />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`}>
              <LogIn />
              <span className="hidden sm:inline">Admin login</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
