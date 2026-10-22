import Link from "next/link"
import { PortalHeader } from "@/components/portal/portal-header"
import { teamSession } from "@/lib/team-auth"

/**
 * The project-team portal: a separate, simpler shell from the club app. Top bar with its own navigation, a warm
 * page backdrop and a narrow reading column. Pages under /team/(workspace) require a team login.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const team = await teamSession()
  return (
    <div className="dotgrid relative min-h-svh">
      {/* The warm glow is its own layer: put on the dotted element it would tile every 22px and show as stripes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(70%_70%_at_50%_-10%,color-mix(in_oklab,var(--brand)_16%,transparent),transparent)]"
      />
      <PortalHeader team={team && { projectTitle: team.projectTitle }} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">{children}</main>
      <footer className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 pt-2 pb-10 text-xs md:px-6">
        <span>TEC Club · project teams</span>
        <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
          Browse the club dashboard →
        </Link>
      </footer>
    </div>
  )
}
