import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Rocket } from "lucide-react"
import { LoginForm } from "@/components/login/login-form"
import { teamSession } from "@/lib/team-auth"

export const metadata: Metadata = { title: "Team login" }

export default async function TeamLoginPage() {
  if (await teamSession()) redirect("/team")
  return (
    <div className="mx-auto grid max-w-md gap-6 pt-6 md:pt-12">
      <div className="grid gap-2 text-center">
        <span className="bg-brand/15 text-brand-strong mx-auto grid size-12 place-items-center rounded-2xl">
          <Rocket className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Project team login</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Post progress, manage your tasks and see the parts your team has borrowed.
        </p>
      </div>
      <div className="bg-card rounded-2xl border p-6 shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--foreground)_30%,transparent)]">
        <LoginForm next="/team" mode="team" />
      </div>
      <p className="text-muted-foreground text-center text-sm">
        Not registered yet?{" "}
        <Link href="/team/signup" className="text-foreground font-medium underline underline-offset-4">
          Register your project
        </Link>
      </p>
    </div>
  )
}
