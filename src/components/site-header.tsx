"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { useIsAdmin, useLogout, useTeam } from "@/components/admin-context"
import { NAV, isNavActive } from "@/components/app-sidebar"
import { TecLogo } from "@/components/tec-logo"

export function SiteHeader() {
  const admin = useIsAdmin()
  const team = useTeam()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [pending, logOut] = useLogout()
  const section = NAV.find((n) => isNavActive(pathname, n.href))

  return (
    <header className="bg-background/85 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      {/* Phones/tablets: the sidebar is a sheet, so the header carries the logo (and is the intro's landing spot). */}
      <Link href="/" aria-label="TEC home" className="mr-1 shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
        <span data-intro-target="logo" className="block">
          <TecLogo height={22} />
        </span>
      </Link>
      {section && (
        <nav aria-label="Breadcrumb" className="eyebrow mr-2 hidden items-center gap-1.5 lg:flex">
          <span>{section.group}</span>
          <span aria-hidden className="text-border">/</span>
          <Link href={section.href} className="text-foreground hover:text-brand-strong transition-colors">
            {section.label}
          </Link>
        </nav>
      )}
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        {admin || team ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={logOut}>
            <LogOut />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`}>
              <LogIn />
              <span className="hidden sm:inline">Log in</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
