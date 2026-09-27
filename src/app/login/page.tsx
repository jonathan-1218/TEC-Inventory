import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isAdmin } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Admin login" }

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams
  // Only allow same-site relative redirects.
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/"

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" /> Admin login
          </CardTitle>
          <CardDescription>
            Browsing is open to everyone. Log in with the club admin password to add, edit, issue or delete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(await isAdmin()) ? (
            <div className="grid gap-3">
              <p className="text-sm">You&apos;re already signed in as admin.</p>
              <Button asChild>
                <Link href={target}>Continue</Link>
              </Button>
            </div>
          ) : (
            <LoginForm next={target} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
