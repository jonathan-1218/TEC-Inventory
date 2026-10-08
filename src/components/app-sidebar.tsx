"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Rocket,
  UserCheck,
  LogOut,
  Users,
  UsersRound,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsAdmin, useLogout, useTeam } from "@/components/admin-context"
import { TecLogo } from "@/components/tec-logo"
import mark from "@/assets/tec-mark.png"
import { cn } from "@/lib/utils"

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/inventory", label: "Inventory", icon: Boxes, group: "Stock" },
  { href: "/issuances", label: "Issuances", icon: ArrowLeftRight, group: "Stock" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "Work" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, group: "Work" },
  { href: "/teams", label: "Teams", icon: UsersRound, group: "Work" },
  { href: "/members", label: "Members", icon: Users, group: "People" },
]
/** Shown only to the matching viewer. */
const ADMIN_NAV = { href: "/accounts", label: "Sign-ups & goals", icon: UserCheck, group: "People" }
const TEAM_NAV = { href: "/my", label: "My project", icon: Rocket, group: "Your team" }

export const isNavActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function AppSidebar() {
  const pathname = usePathname()
  const admin = useIsAdmin()
  const team = useTeam()
  const [pending, logOut] = useLogout()
  const { setOpenMobile } = useSidebar()
  const nav = [...(team ? [TEAM_NAV] : []), ...NAV, ...(admin ? [ADMIN_NAV] : [])]
  const groups = [...new Set(nav.map((n) => n.group))]
  const close = () => setOpenMobile(false)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="h-auto py-2 hover:bg-transparent active:bg-transparent">
              <Link href="/" onClick={close} aria-label="TEC home">
                {/* Collapsed to icons: just the pulse mark. */}
                <Image src={mark} alt="" className="hidden size-8 rounded-md group-data-[collapsible=icon]:block" />
                <span className="flex min-w-0 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
                  <span data-intro-target="logo" className="block w-fit">
                    <TecLogo height={36} className="shrink-0" />
                  </span>
                  <span className="eyebrow truncate text-[10px]">Inventory · Projects</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0 pt-1">
        {groups.map((group) => (
          <SidebarGroup key={group} className="py-1.5">
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.filter((n) => n.group === group).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isNavActive(pathname, item.href)} tooltip={item.label}>
                      <Link href={item.href} onClick={close}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  admin || team ? "bg-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_22%,transparent)]" : "ring-muted-foreground ring-1 ring-inset"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {admin ? "Admin mode" : team ? team.projectTitle : "Read-only"}
                </span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {admin ? "Edits enabled" : team ? "Team login · your project only" : "Log in to make changes"}
                </span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {admin || team ? (
              <SidebarMenuButton tooltip="Log out" disabled={pending} onClick={logOut}>
                <LogOut />
                <span>Log out</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild tooltip="Log in">
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={close}>
                  <LogIn />
                  <span>Log in</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
