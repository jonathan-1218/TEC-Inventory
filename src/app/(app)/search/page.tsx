import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Boxes, FolderKanban, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { searchAll } from "@/lib/queries"

export const metadata: Metadata = { title: "Search" }

const GROUPS = [
  { type: "component", heading: "Components", icon: Boxes },
  { type: "project", heading: "Projects", icon: FolderKanban },
  { type: "member", heading: "Members", icon: User },
] as const

/** Wraps case-insensitive matches of `q` in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return text
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  return parts.map((p, i) =>
    i % 2 ? (
      <mark key={i} className="bg-brand-soft text-brand-strong rounded-[2px]">
        {p}
      </mark>
    ) : (
      p
    )
  )
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams
  const query = typeof q === "string" ? q.slice(0, 100).trim() : ""
  const results = await searchAll(query, 50)
  const groups = GROUPS.map((g) => ({ ...g, items: results.filter((r) => r.type === g.type) }))

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader eyebrow="Find" title="Search" description="Components, projects and members — by name, model, roll number or tech tag." />
      <form className="flex max-w-2xl gap-2" action="/search" role="search">
        <InputGroup className="h-10 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            type="search"
            defaultValue={query}
            placeholder="e.g. ESP32, rover, 24CS…"
            aria-label="Search"
            autoFocus
          />
        </InputGroup>
        <Button type="submit" variant="brand" className="h-10 px-4">
          Search
        </Button>
      </form>

      {query && (
        <p className="eyebrow -mt-2 tabular-nums" aria-live="polite">
          {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
          {results.length > 0 && ` · ${groups.map((g) => `${g.items.length} ${(g.items.length === 1 ? g.heading.slice(0, -1) : g.heading).toLowerCase()}`).join(" · ")}`}
        </p>
      )}

      {query && results.length === 0 && (
        <EmptyState icon={Search} title={`Nothing matches “${query}”`} description="Try a model number, a roll number or a tech tag like MQTT." />
      )}
      {!query && (
        <p className="text-muted-foreground text-sm">
          Tip: press <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> anywhere to search and jump.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.type} className="gap-0 pb-2">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2">
                  <g.icon className="text-muted-foreground size-4" /> {g.heading}
                  <span className="text-muted-foreground ml-auto font-mono text-xs font-normal tabular-nums">{g.items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-0.5 px-2 pt-2">
                {g.items.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 font-mono text-[11px]">No matches</p>
                ) : (
                  g.items.map((r) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="group/result hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-2 rounded-md px-2 py-2 outline-none focus-visible:ring-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <Highlight text={r.title} q={query} />
                        </p>
                        {r.subtitle && (
                          <p className="text-muted-foreground truncate font-mono text-[11px]">
                            <Highlight text={r.subtitle} q={query} />
                          </p>
                        )}
                      </div>
                      <ArrowUpRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover/result:opacity-100" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
