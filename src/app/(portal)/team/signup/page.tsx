import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { db } from "@/lib/db"
import { SignupForm } from "./signup-form"

export const metadata: Metadata = { title: "Register your project" }

export default async function SignupPage() {
  const mentors = await db.mentor.findMany({
    select: { id: true, name: true, designation: true, department: true },
    orderBy: { name: "asc" },
  })
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        eyebrow="Project teams"
        title="Register your project"
        description="Tell us who's building it and who mentors it. A club admin approves the sign-up, then you can log in to post progress and manage your tasks."
      />
      <SignupForm mentors={mentors} />
    </div>
  )
}
