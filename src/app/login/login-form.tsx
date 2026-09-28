"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { login } from "@/app/actions/auth"
import { runAction } from "@/lib/client"

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const password = String(new FormData(e.currentTarget).get("password") ?? "")
        startTransition(async () => {
          const res = await runAction(login({ password }), "Welcome, admin")
          if (res.ok) {
            router.replace(next)
            router.refresh()
          } else setError(res.error)
        })
      }}
    >
      <FormField label="Password" htmlFor="password" error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="h-10 font-mono tracking-widest"
        />
      </FormField>
      <Button type="submit" variant="brand" className="h-10" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </Button>
    </form>
  )
}
