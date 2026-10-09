import type { Metadata } from "next"
import { LoginScreen } from "./login-screen"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams
  return <LoginScreen next={next} mode="team" />
}
