import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AdminProvider } from "@/components/admin-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { isAdmin } from "@/lib/auth"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "TEC Inventory", template: "%s · TEC Inventory" },
  description: "Inventory and project tracker for the TEC tech club",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading cookies makes every page render per-request, so data is always fresh.
  const [admin, cookieStore] = await Promise.all([isAdmin(), cookies()])
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <AdminProvider isAdmin={admin}>
              <SidebarProvider defaultOpen={sidebarOpen}>
                <AppSidebar />
                <SidebarInset>
                  <SiteHeader />
                  <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
                </SidebarInset>
              </SidebarProvider>
            </AdminProvider>
          </TooltipProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
