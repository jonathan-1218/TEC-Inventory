"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Boxes,
  CornerDownLeft,
  FolderKanban,
  FolderPlus,
  LogIn,
  LogOut,
  PackageMinus,
  PackagePlus,
  Search,
  SunMoon,
  User,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { useIsAdmin, useLogout } from "@/components/admin-context"
import { NAV } from "@/components/app-sidebar"
import { IssueDialog } from "@/components/issue-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { search } from "@/app/actions/search"
import { issueOptions } from "@/app/issuances/actions"
import type { SearchResult, SelectOptions } from "@/lib/queries"

const GROUPS = [
  { type: "component", heading: "Components", icon: Boxes },
  { type: "project", heading: "Projects", icon: FolderKanban },
  { type: "member", heading: "Members", icon: User },
] as const

const PAGES = [...NAV, { href: "/search", label: "Search", icon: Search, group: "Find" }]

/** `admin`: true = admins only, false = visitors only, omitted = everyone. */
type ActionId = "issue" | "component" | "project" | "theme" | "logout" | "login"
const ACTIONS: { id: ActionId; label: string; icon: LucideIcon; keywords: string; admin?: boolean }[] = [
  { id: "issue", label: "Issue component", icon: PackageMinus, keywords: "checkout lend give", admin: true },
  { id: "component", label: "Add component", icon: PackagePlus, keywords: "new part inventory stock", admin: true },
  { id: "project", label: "New project", icon: FolderPlus, keywords: "create project", admin: true },
  { id: "theme", label: "Toggle theme", icon: SunMoon, keywords: "toggle theme dark light mode appearance" },
  { id: "logout", label: "Log out", icon: LogOut, keywords: "sign out admin", admin: true },
  { id: "login", label: "Admin login", icon: LogIn, keywords: "sign in password", admin: false },
]

const matches = (q: string, ...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q))

/** ⌘K / Ctrl+K palette: jump to pages, run actions, and search components, projects and members. */
export function GlobalSearch() {
  const router = useRouter()
  const admin = useIsAdmin()
  const { resolvedTheme, setTheme } = useTheme()
  const [, logOut] = useLogout()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  // Dialogs opened from the palette live here, outside the palette (which closes first).
  const [dialog, setDialog] = useState<"issue" | "component" | null>(null)
  const [options, setOptions] = useState<SelectOptions | null>(null)

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

  function close() {
    setOpen(false)
    onQueryChange("")
  }

  function go(href: string) {
    close()
    router.push(href)
  }

  async function openIssue() {
    close()
    // Fresh each time: availability changes with every checkout.
    const opts = await issueOptions().catch(() => null)
    if (!opts) return void toast.error("Couldn't load the issue form. Please try again.")
    setOptions(opts)
    setDialog("issue")
  }

  function runAction(id: ActionId) {
    if (id === "issue") return void openIssue()
    if (id === "project") return go("/projects?new=1")
    if (id === "login") return go("/login")
    close()
    if (id === "component") setDialog("component")
    else if (id === "theme") setTheme(resolvedTheme === "dark" ? "light" : "dark")
    else if (id === "logout") logOut()
  }

  const q = query.trim().toLowerCase()
  const pages = PAGES.filter((p) => matches(q, p.label, p.group))
  const shownActions = ACTIONS.filter(
    (a) => (a.admin === undefined || a.admin === admin) && matches(q, a.label, a.keywords)
  ).map((a) =>
    a.id === "theme" ? { ...a, label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme" } : a
  )
  const hasHits = pages.length > 0 || shownActions.length > 0 || results.length > 0

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
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title="Command palette"
        description="Jump to a page, run an action, or search components, projects and members"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search parts, projects, people — or type a command…"
            value={query}
            onValueChange={onQueryChange}
          />
          <CommandList className="max-h-[min(24rem,60svh)]">
            {q && !loading && !hasHits && <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>}
            {GROUPS.map((g) => {
              const items = results.filter((r) => r.type === g.type)
              if (!items.length) return null
              return (
                <CommandGroup key={g.type} heading={g.heading}>
                  {items.map((r) => (
                    <CommandItem key={r.id} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)}>
                      <g.icon className="text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate">{r.title}</p>
                        {r.subtitle && <p className="text-muted-foreground truncate font-mono text-[11px]">{r.subtitle}</p>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
            {q && loading && results.length === 0 && (
              <p className="text-muted-foreground px-3 py-2 font-mono text-[11px]" aria-live="polite">
                Searching…
              </p>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Go to">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon className="text-muted-foreground" />
                    {p.label}
                    <CommandShortcut className="font-mono text-[10px] tracking-normal">{p.group}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {shownActions.length > 0 && (
              <CommandGroup heading="Actions">
                {shownActions.map((a) => (
                  <CommandItem key={a.id} value={`action-${a.id}`} onSelect={() => runAction(a.id)}>
                    <a.icon className="text-muted-foreground" />
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {q && (
              <CommandGroup>
                <CommandItem value="__all" onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
                  <Search className="text-muted-foreground" />
                  See all results for “{query.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          <div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 font-mono text-[10px] tracking-wide uppercase">
            <span className="flex items-center gap-1">
              <kbd className="bg-muted rounded px-1">↑↓</kbd> move
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted grid place-items-center rounded px-1">
                <CornerDownLeft className="size-2.5" />
              </kbd>{" "}
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted rounded px-1">esc</kbd> close
            </span>
          </div>
        </Command>
      </CommandDialog>

      {admin && options && (
        <IssueDialog options={options} open={dialog === "issue"} onOpenChange={(o) => !o && setDialog(null)} />
      )}
      {admin && (
        <ComponentFormDialog open={dialog === "component"} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </>
  )
}
