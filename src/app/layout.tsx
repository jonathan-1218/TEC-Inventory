import type { Metadata } from "next"
import { Archivo, Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AdminProvider } from "@/components/admin-context"
import { isAdmin } from "@/lib/auth"
import { teamSession } from "@/lib/team-auth"
import { getDesignations } from "@/lib/designations"
import { DesignationsProvider } from "@/components/designations-context"
import { TransitionOverlay } from "@/components/transition-overlay"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
// Display face (page titles, KPI numbers): variable width axis lets it run wide and blocky like the logo.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] })

export const metadata: Metadata = {
  title: { default: "TEC Inventory", template: "%s · TEC Inventory" },
  description: "Inventory and project tracker for the TEC tech club",
}

/**
 * Shared by both halves of the site: the club app ((app) — sidebar, dashboard, admin) and the project-team
 * portal ((portal) — /team). Each group adds its own shell.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [admin, team, designations] = await Promise.all([isAdmin(), teamSession(), getDesignations()])

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <DesignationsProvider designations={designations}>
              <AdminProvider isAdmin={admin} team={team && { projectId: team.projectId, projectTitle: team.projectTitle }}>
                {children}
              </AdminProvider>
            </DesignationsProvider>
          </TooltipProvider>
          <TransitionOverlay />
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
