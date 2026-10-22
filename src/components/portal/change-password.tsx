"use client"

import { useState, useTransition } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { changeOwnPassword } from "@/app/actions/accounts"
import { runAction } from "@/lib/client"
import { PASSWORD_MIN, passwordProblems } from "@/lib/password-strength"

/** "Change password" for the signed-in team: current password + a new one that meets the sign-up rules. */
export function ChangePassword({ label = "Change password" }: { label?: string }) {
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [next, setNext] = useState("")
  const [pending, start] = useTransition()
  const hint = next ? (passwordProblems(next)[0] ?? "Looks strong") : `At least ${PASSWORD_MIN} characters; a long passphrase works best.`

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        setErrors({})
        setNext("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your team&apos;s password</DialogTitle>
          <DialogDescription>
            Everyone on your team shares this login. You&apos;ll stay logged in here; other devices will need the new password.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            if (form.get("password") !== form.get("confirm")) return setErrors({ confirm: ["The two passwords don't match."] })
            start(async () => {
              const res = await runAction(
                changeOwnPassword({ current: String(form.get("current") ?? ""), password: String(form.get("password") ?? "") }),
                "Password changed"
              )
              if (res.ok) setOpen(false)
              else setErrors(res.fieldErrors ?? { current: [res.error] })
            })
          }}
        >
          <FormField label="Current password" htmlFor="pw-current" error={errors.current}>
            <Input id="pw-current" name="current" type="password" autoComplete="current-password" required maxLength={200} />
          </FormField>
          <FormField label="New password" htmlFor="pw-new" error={errors.password} hint={hint}>
            <Input
              id="pw-new"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={200}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm}>
            <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={200} />
          </FormField>
          <DialogFooter>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
