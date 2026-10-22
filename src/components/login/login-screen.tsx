import Link from "next/link"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isAdmin } from "@/lib/auth"
import { teamSession } from "@/lib/team-auth"
import { safePath } from "@/lib/safe-path"
import { TecLogo } from "@/components/tec-logo"
import { LoginForm } from "./login-form"

export async function LoginScreen({ next, mode }: { next: unknown; mode: "team" | "admin" }) {
  // Only allow same-site relative redirects (see safePath — blocks protocol-relative and control-char bypasses).
  const target = safePath(next)
  const admin = mode === "admin" ? await isAdmin() : !!(await teamSession())

  return (
    <div className="flex min-h-[calc(100svh-9rem)] items-center justify-center py-6">
      <div className="bg-card w-full max-w-sm overflow-hidden rounded-xl border shadow-[0_1px_0_0_var(--border),0_24px_48px_-24px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <div className="relative grid place-items-center gap-4 border-b px-6 pt-10 pb-6">
          <TecLogo height={68} />
          {/* Instrument ruler under the logo. */}
          <div
            aria-hidden
            className="h-2 w-40 bg-[repeating-linear-gradient(90deg,var(--border)_0_1px,transparent_1px_8px)] [mask-image:linear-gradient(90deg,transparent,#000_20%,#000_80%,transparent)]"
          />
          <p className="eyebrow">Inventory · Projects · Club</p>
        </div>
        <div className="grid gap-5 px-6 pt-6 pb-6">
          <div className="grid gap-1.5">
            <p className="eyebrow flex items-center gap-2">
              <LockKeyhole className="text-brand-strong size-3.5" /> {mode === "admin" ? "Admin access" : "Project team"}
            </p>
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">
              {admin ? "You're signed in" : mode === "admin" ? "Admin login" : "Log in to your project"}
            </h1>
            <p className="text-muted-foreground text-sm text-pretty">
              {mode === "admin"
                ? "The club admin password unlocks adding, editing, issuing and deleting."
                : "Approved project teams log in to post progress, manage tasks and see their loans."}
            </p>
          </div>
          {admin ? (
            <Button asChild variant="brand" className="h-10">
              <Link href={target}>Continue</Link>
            </Button>
          ) : (
            <LoginForm next={target} mode={mode} totp={mode === "admin" && !!process.env.ADMIN_TOTP_SECRET} />
          )}
        </div>
        <div className="bg-muted/40 border-t px-6 py-3">
          <Link
            href={target}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="size-3.5" /> Keep browsing without logging in
          </Link>
        </div>
      </div>
    </div>
  )
}
