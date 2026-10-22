import { cookies } from "next/headers"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Intro } from "@/components/intro/intro"
import { SiteHeader } from "@/components/site-header"

/** The club app: sidebar, header and the logo intro. Project teams have their own portal under /team. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Reading cookies also makes every page render per-request, so data is always fresh.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <>
      <Intro />
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        <SidebarInset className="dotgrid">
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
