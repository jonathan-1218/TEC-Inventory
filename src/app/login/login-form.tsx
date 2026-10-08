"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FormField } from "@/components/form-field"
import { login } from "@/app/actions/auth"
import { teamLogin } from "@/app/actions/accounts"
import { runAction } from "@/lib/client"

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<"team" | "admin">("team")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  return (
    <div className="grid gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(v) => {
          if (v) setMode(v as "team" | "admin")
          setError(undefined)
        }}
        className="w-full"
        aria-label="Log in as"
      >
        <ToggleGroupItem value="team" className="flex-1">Project team</ToggleGroupItem>
        <ToggleGroupItem value="admin" className="flex-1">Club admin</ToggleGroupItem>
      </ToggleGroup>
      <form
        key={mode}
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const password = String(form.get("password") ?? "")
          startTransition(async () => {
            if (mode === "admin") {
              const res = await runAction(login({ password }), "Welcome, admin")
              if (!res.ok) return setError(res.error)
              router.replace(next)
            } else {
              const res = await runAction(teamLogin({ email: String(form.get("email") ?? ""), password }), "Welcome back")
              if (!res.ok) return setError(res.error)
              router.replace(next === "/" ? "/my" : next)
            }
            router.refresh()
          })
        }}
      >
        {mode === "team" && (
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus required className="h-10" />
          </FormField>
        )}
        <FormField label={mode === "admin" ? "Admin password" : "Password"} htmlFor="password" error={error}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus={mode === "admin"}
            required
            className="h-10 font-mono tracking-widest"
          />
        </FormField>
        <Button type="submit" variant="brand" className="h-10" disabled={pending}>
          {pending ? "Checking…" : "Log in"}
        </Button>
        {mode === "team" && (
          <p className="text-muted-foreground text-center text-sm">
            New project?{" "}
            <Link href="/signup" className="text-foreground font-medium underline underline-offset-4">
              Register your team
            </Link>
          </p>
        )}
      </form>
    </div>
  )
}
