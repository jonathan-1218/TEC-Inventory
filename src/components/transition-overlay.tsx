"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { hideOverlay, useOverlay } from "@/lib/overlay"

/** Full-screen loading state for logging in and out, so the change of page never looks like a freeze. */
export function TransitionOverlay() {
  const { message, startPath } = useOverlay()
  const pathname = usePathname()

  // The page has changed: give the new one a moment to paint, then fade the overlay out.
  useEffect(() => {
    if (message === null || startPath === null || pathname === startPath) return
    const t = setTimeout(hideOverlay, 450)
    return () => clearTimeout(t)
  }, [pathname, message, startPath])

  if (message === null) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background/85 fixed inset-0 z-[200] grid place-items-center backdrop-blur-md [animation:overlay-in_180ms_ease-out_both]"
    >
      <div className="grid justify-items-center gap-5">
        {/* The club's pulse symbol: the line draws itself across the tile, over a soft glow and two ripples. */}
        <div className="relative grid size-24 place-items-center">
          <span aria-hidden className="overlay-ripple border-brand/50 absolute inset-2 rounded-3xl border" />
          <span aria-hidden className="overlay-ripple border-brand/40 absolute inset-2 rounded-3xl border [animation-delay:0.7s]" />
          <span className="overlay-tile relative grid size-[4.5rem] place-items-center rounded-2xl bg-[#14110b] shadow-[0_0_0_1px_rgb(233_151_4/0.35)]">
            <svg viewBox="0 0 56 20" className="w-12" fill="none" stroke="#e99704" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path className="overlay-pulse" pathLength={1} d="M2 10h18l3-7 5 15 4-11 2 3h20" />
            </svg>
          </span>
        </div>
        <p className="font-display text-lg font-extrabold tracking-tight">{message}</p>
        <div aria-hidden className="bg-foreground/15 relative h-1.5 w-48 overflow-hidden rounded-full">
          <span className="bg-brand absolute inset-y-0 w-1/3 rounded-full motion-safe:animate-[overlay-bar_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  )
}
