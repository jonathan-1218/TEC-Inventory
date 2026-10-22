"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { login } from "@/app/actions/auth"
import { teamLogin } from "@/app/actions/accounts"
import { runAction } from "@/lib/client"
import { hideOverlay, showOverlay } from "@/lib/overlay"

/** Team login (email + password) on /login; the admin password form lives only on /admin. */
export function LoginForm({ next, mode, totp = false }: { next: string; mode: "team" | "admin"; totp?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const password = String(form.get("password") ?? "")
          startTransition(async () => {
            showOverlay("Signing you in…")
            if (mode === "admin") {
              const res = await runAction(login({ password, code: String(form.get("code") ?? "") }), "Welcome, admin")
              if (!res.ok) {
                hideOverlay()
                return setError(res.error)
              }
              router.replace(next)
            } else {
              const res = await runAction(teamLogin({ email: String(form.get("email") ?? ""), password }), "Welcome back")
              if (!res.ok) {
                hideOverlay()
                return setError(res.error)
              }
              router.replace("/team")
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
        {mode === "admin" && totp && (
          <FormField label="Authenticator code" htmlFor="code" hint="6 digits from your authenticator app.">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className="h-10 font-mono tracking-[0.4em]"
            />
          </FormField>
        )}
        <Button type="submit" variant="brand" className="h-10" disabled={pending}>
          {pending ? "Checking…" : "Log in"}
        </Button>
      </form>
    </div>
  )
}
