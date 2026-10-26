import type { Metadata } from "next"
import Home from "@/components/site/Home"
import { Intro } from "@/components/intro/intro"
import "./site.css"

export const metadata: Metadata = {
  title: { absolute: "TEC — The Electronics Club, LICET" },
  description: "The Electronics Club of LICET. Inspiring the next.",
}

export default function Page() {
  return (
    <>
      <Intro />
      <Home />
    </>
  )
}
