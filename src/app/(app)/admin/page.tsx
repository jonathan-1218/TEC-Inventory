import type { Metadata } from "next"
import { LoginScreen } from "@/components/login/login-screen"

export const metadata: Metadata = { title: "Admin login", robots: { index: false } }

export default async function AdminLoginPage(props: PageProps<"/admin">) {
  const { next } = await props.searchParams
  return <LoginScreen next={next} mode="admin" />
}
