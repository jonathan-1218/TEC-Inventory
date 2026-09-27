"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  Boxes,
  CircuitBoard,
  FolderKanban,
  LayoutDashboard,
  Users,
  UsersRound,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsAdmin } from "@/components/admin-context"

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/issuances", label: "Issuances", icon: ArrowLeftRight },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/teams", label: "Teams", icon: UsersRound },
  { href: "/members", label: "Members", icon: Users },
]

export function AppSidebar() {
  const pathname = usePathname()
  const admin = useIsAdmin()
  const { setOpenMobile } = useSidebar()
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <CircuitBoard className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">TEC</span>
                  <span className="text-muted-foreground truncate text-xs">Inventory & Projects</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-muted-foreground truncate px-2 text-xs group-data-[collapsible=icon]:hidden">
          {admin ? "Signed in as admin" : "Read-only mode"}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
