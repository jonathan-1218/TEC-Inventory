import { AdminProvider } from "@/components/admin-context"
import { requireTeam } from "@/lib/portal"

/**
 * Everything under /team except login and sign-up needs a team login. The nested provider only switches on the
 * project's edit controls (tasks, progress); the server actions re-check that the project is the team's own.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireTeam()
  return <AdminProvider isAdmin>{children}</AdminProvider>
}
