import { redirect } from "next/navigation"
import { teamSession } from "@/lib/team-auth"

/** The signed-in project team, or a redirect to the portal's login. */
export async function requireTeam() {
  const team = await teamSession()
  if (!team) redirect("/team/login")
  return team
}
