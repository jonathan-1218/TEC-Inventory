import type { Metadata } from "next"
import Link from "next/link"
import { Boxes, FolderKanban, Search, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { searchAll } from "@/lib/queries"

export const metadata: Metadata = { title: "Search" }

const GROUPS = [
  { type: "component", heading: "Components", icon: Boxes },
  { type: "project", heading: "Projects", icon: FolderKanban },
  { type: "member", heading: "Members", icon: User },
] as const

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams
  const query = typeof q === "string" ? q.slice(0, 100) : ""
  const results = await searchAll(query, 50)

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Search" description="Find components, projects and members." />
      <form className="flex max-w-xl gap-2" action="/search">
        <Input name="q" defaultValue={query} placeholder="e.g. ESP32, rover, 21CS…" autoFocus />
        <Button type="submit">
          <Search /> Search
        </Button>
      </form>
      {query && results.length === 0 && (
        <EmptyState icon={Search} title={`No results for “${query}”`} description="Try a model number, roll number or tech tag." />
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {GROUPS.map((g) => {
          const items = results.filter((r) => r.type === g.type)
          if (!items.length) return null
          return (
            <Card key={g.type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <g.icon className="size-4" /> {g.heading}
                  <span className="text-muted-foreground font-normal">({items.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                {items.map((r) => (
                  <Link key={r.id} href={r.href} className="hover:bg-muted -mx-2 rounded-md px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    {r.subtitle && <p className="text-muted-foreground truncate text-xs">{r.subtitle}</p>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
