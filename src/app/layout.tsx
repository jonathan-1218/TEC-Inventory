import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Archivo, Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AdminProvider } from "@/components/admin-context"
import { AppSidebar } from "@/components/app-sidebar"
import { Intro } from "@/components/intro/intro"
import { SiteHeader } from "@/components/site-header"
import { isAdmin } from "@/lib/auth"
import { teamSession } from "@/lib/team-auth"
import { getDesignations } from "@/lib/designations"
import { DesignationsProvider } from "@/components/designations-context"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
// Display face (page titles, KPI numbers): variable width axis lets it run wide and blocky like the logo.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] })

export const metadata: Metadata = {
  title: { default: "TEC Inventory", template: "%s · TEC Inventory" },
  description: "Inventory and project tracker for the TEC tech club",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading cookies makes every page render per-request, so data is always fresh.
  const [admin, team, cookieStore, designations] = await Promise.all([isAdmin(), teamSession(), cookies(), getDesignations()])
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Intro />
          <TooltipProvider>
            <DesignationsProvider designations={designations}>
            <AdminProvider isAdmin={admin} team={team && { projectId: team.projectId, projectTitle: team.projectTitle }}>
              <SidebarProvider defaultOpen={sidebarOpen}>
                <AppSidebar />
                <SidebarInset className="dotgrid">
                  <SiteHeader />
                  <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
                </SidebarInset>
              </SidebarProvider>
            </AdminProvider>
            </DesignationsProvider>
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
