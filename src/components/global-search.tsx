"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Boxes, FolderKanban, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { search } from "@/app/actions/search"
import type { SearchResult } from "@/lib/queries"

const GROUPS = [
  { type: "component", heading: "Components", icon: Boxes },
  { type: "project", heading: "Projects", icon: FolderKanban },
  { type: "member", heading: "Members", icon: User },
] as const

/** Cmd/Ctrl+K palette searching components, projects and members. */
export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(0)

  // Debounced search; only the newest request may update results.
  function onQueryChange(value: string) {
    setQuery(value)
    clearTimeout(timer.current)
    const q = value.trim()
    const id = ++latest.current
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await search(q)
        if (id === latest.current) setResults(r)
      } finally {
        if (id === latest.current) setLoading(false)
      }
    }, 200)
  }

  function go(href: string) {
    setOpen(false)
    onQueryChange("")
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground w-full max-w-64 min-w-0 shrink justify-start gap-2 font-normal"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="truncate">Search…</span>
        <kbd className="bg-muted ml-auto hidden rounded px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search components, projects and members"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search components, projects, members…"
            value={query}
            onValueChange={onQueryChange}
          />
          <CommandList>
            {query.trim() && !loading && <CommandEmpty>No results.</CommandEmpty>}
            {GROUPS.map((g) => {
              const items = results.filter((r) => r.type === g.type)
              if (!items.length) return null
              return (
                <CommandGroup key={g.type} heading={g.heading}>
                  {items.map((r) => (
                    <CommandItem key={r.id} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)}>
                      <g.icon />
                      <div className="min-w-0">
                        <p className="truncate">{r.title}</p>
                        {r.subtitle && <p className="text-muted-foreground truncate text-xs">{r.subtitle}</p>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
            {query.trim() && (
              <CommandGroup>
                <CommandItem
                  value="__all"
                  onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                >
                  <Search />
                  See all results for “{query.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
