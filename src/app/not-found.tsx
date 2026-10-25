import Link from "next/link"
import { ArrowLeft, Search, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"

export default function NotFound() {
  return (
    <main className="dotgrid mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <PageHeader eyebrow="Error 404 · No signal" title="Nothing on this channel" />
      <EmptyState
        icon={Unplug}
        title="This page isn't wired up"
        description="The part, project or person may have been deleted, or the link is off by a character."
      >
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="brand" asChild>
            <Link href="/dashboard">
              <ArrowLeft /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/search">
              <Search /> Search
            </Link>
          </Button>
        </div>
      </EmptyState>
    </main>
  )
}
