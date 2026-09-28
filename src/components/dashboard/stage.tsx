"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { animate, useReducedMotion } from "motion/react"
import { cn } from "cn"
import { formatNumber } from "@/components/charts/shared"
import { APP_TIME_ZONE } from "@/lib/dates"
import styles from "./stage.module.css"

// The intro (components/intro) sets <html data-intro="play"> while it runs and data-intro-done when it's over,
// then fires `tec:intro-done`. Anything else (no intro this session, reduced motion) means "go now".
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro", "data-intro-done"] })
  window.addEventListener("tec:intro-done", onChange)
  return () => {
    observer.disconnect()
    window.removeEventListener("tec:intro-done", onChange)
  }
}
const introOver = () => {
  const d = document.documentElement.dataset
  return d.intro !== "play" || d.introDone !== undefined
}

/**
 * Wraps the dashboard. Server HTML renders in "wait" (panels hidden); after hydration, once the intro is over, the
 * key flips to "live" and the subtree remounts, so the panel stagger, chart draw-ins and count-ups play in view.
 */
export function Stage({ className, children }: { className?: string; children: React.ReactNode }) {
  const live = useSyncExternalStore(subscribe, introOver, () => false)
  return (
    <div key={live ? "live" : "wait"} data-stage={live ? "live" : "wait"} className={cn(styles.stage, className)}>
      {children}
    </div>
  )
}

/** Counts up from 0 (or the previous value) to `value` on mount/change; instant under reduced motion. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = formatNumber(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v
        el.textContent = formatNumber(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return (
    <>
      <span ref={ref} aria-hidden>
        {formatNumber(value)}
      </span>
      <span className="sr-only">{formatNumber(value)}</span>
    </>
  )
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE })

/** Club-time clock for the readout strip; ticks every 15 s. */
export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  return (
    <time suppressHydrationWarning dateTime={now.toISOString()}>
      {timeFmt.format(now)}
    </time>
  )
}
