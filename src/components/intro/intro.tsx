"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from "react"
import { usePathname } from "next/navigation"
import {
  BLOCK_C,
  BLOCK_TE,
  LogoDefs,
  PADS,
  PCB_ENTRY,
  PULSE,
  PULSE_WIDTH,
  TRACES,
  VIEWBOX,
  tracePath,
} from "@/components/tec-logo"
import s from "./intro.module.css"

// Timeline (ms from first paint). The build runs on CSS alone, so it starts before hydration; JS only does the flight.
const T = { te: 60, c: 180, pulse: 520, pulseDur: 950, pcb: 1300, eyebrow: 1500, greet: 1660, fly: 2900, flyDur: 580 }
const MS_PER_UNIT = 1.5 // PCB "current" spreads out from where the pulse meets the C

// Decides before first paint whether this page load plays the intro (hard loads of "/dashboard" only, once per tab session,
// never under reduced motion). Pages read html[data-intro-done] or wait for the "tec:intro-done" event.
const SCRIPT = `(function(){var d=document.documentElement,p=false;try{if(location.pathname==="/dashboard"&&!sessionStorage.getItem("tec-intro-seen")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("tec-intro-seen","1");p=true}}catch(e){}if(p){var h=new Date().getHours();d.dataset.intro="play";d.dataset.introPart=h>=5&&h<12?"morning":h>=12&&h<17?"afternoon":"evening";d.dataset.introT0=String(performance.now())}else d.dataset.introDone="1"})()`

const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" }

const [EX, EY] = PCB_ENTRY
// Each trace draws away from the entry point, starting when the "current" reaches its near end.
const SEGMENTS = TRACES.map(([x1, y1, x2, y2, w]) => {
  const flip = Math.hypot(x2 - EX, y2 - EY) < Math.hypot(x1 - EX, y1 - EY)
  const [ax, ay, bx, by] = flip ? [x2, y2, x1, y1] : [x1, y1, x2, y2]
  return {
    d: tracePath([ax, ay, bx, by]),
    w,
    delay: T.pcb + Math.hypot(ax - EX, ay - EY) * MS_PER_UNIT,
    dur: Math.max(140, Math.hypot(bx - ax, by - ay) * 2.4),
  }
})
const PAD_DELAYS = PADS.map(([cx, cy]) => T.pcb + 120 + Math.hypot(cx - EX, cy - EY) * MS_PER_UNIT)
const ALL_TRACES = TRACES.map(tracePath).join("")

const vars = (delay: number, dur?: number) =>
  ({ "--delay": `${delay}ms`, ...(dur ? { "--dur": `${dur}ms` } : {}) }) as CSSProperties

const subscribe = (cb: () => void) => {
  window.addEventListener("tec:intro-done", cb)
  return () => window.removeEventListener("tec:intro-done", cb)
}
const isPlaying = () => {
  const d = document.documentElement.dataset
  return d.intro === "play" && !d.introDone
}

/** First-visit intro: the logo builds, says hello, then flies into the sidebar logo. Mount once in the root layout. */
export function Intro() {
  const isHome = usePathname() === "/dashboard"
  // The server can't know, so it renders the (CSS-hidden) stage on "/dashboard"; the client then drops it unless it plays.
  const playing = useSyncExternalStore(subscribe, isPlaying, () => isHome)
  const [announce, setAnnounce] = useState("")
  const stage = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const logo = useRef<SVGSVGElement>(null)
  const fade = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!playing) return
    const html = document.documentElement
    const elapsed = performance.now() - Number(html.dataset.introT0 ?? 0)
    let target: SVGElement | HTMLElement | null = null
    let done = false
    let flying = false

    const finish = () => {
      if (done) return
      done = true
      if (target) target.style.visibility = ""
      if (stage.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
      html.dataset.introDone = "1"
      window.dispatchEvent(new Event("tec:intro-done"))
    }

    const skip = () => {
      if (flying || done || !stage.current) return
      flying = true
      stage.current.style.pointerEvents = "none"
      stage.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" })
        .finished.then(finish, finish)
    }

    const fly = () => {
      if (flying || done || !stage.current || !logo.current || !backdrop.current || !fade.current) return finish()
      flying = true
      stage.current.style.pointerEvents = "none"
      const from = logo.current.getBoundingClientRect()
      // Sidebar logo on desktop, header logo on phones/tablets: fly to whichever one is visible.
      const el = [...document.querySelectorAll<HTMLElement>('[data-intro-target="logo"]')]
        .map((host) => host.querySelector<SVGElement>("svg[data-tec-logo]") ?? host)
        .find((e) => e.getBoundingClientRect().width > 0)
      const to = el?.getBoundingClientRect()
      const onScreen =
        !!el && !!to && to.width > 0 && to.height > 0 && to.right > 0 && to.bottom > 0 && to.left < innerWidth && to.top < innerHeight
      // Missing or hidden target (mobile sheet, collapsed rail): shrink toward the top-left corner and fade out.
      const dest = onScreen ? to : { left: 16, top: 14, width: (from.width * 28) / from.height }
      if (onScreen) {
        target = el
        el.style.visibility = "hidden"
      }
      const scale = dest.width / from.width
      const end = `translate(${dest.left - from.left}px, ${dest.top - from.top}px) scale(${scale})`
      const opts = { duration: T.flyDur, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "forwards" } as const
      backdrop.current.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, easing: "ease-in-out" })
      fade.current.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-8px)" }], { ...opts, duration: 240 })
      logo.current
        .animate([{ transform: "none" }, onScreen ? { transform: end } : { transform: end, opacity: 0 }], opts)
        .finished.then(finish, finish)
    }

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip()
    const part = html.dataset.introPart as keyof typeof GREETING
    const flyTimer = setTimeout(fly, Math.max(0, T.fly - elapsed))
    const sayTimer = setTimeout(() => setAnnounce(`${GREETING[part] ?? "Hello"} — welcome to TEC`), Math.max(0, T.greet - elapsed))
    // Any click on the stage (the Skip button included) skips.
    const node = stage.current
    node?.addEventListener("click", skip)
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(flyTimer)
      clearTimeout(sayTimer)
      node?.removeEventListener("click", skip)
      window.removeEventListener("keydown", onKey)
    }
  }, [playing])

  return (
    <>
      <InlineScript html={SCRIPT} />
      {playing && (
        <div ref={stage} className={s.stage}>
          <div aria-hidden="true">
            <div ref={backdrop} className={s.backdrop} />
            <div className={s.center}>
              <IntroLogo ref={logo} />
              <div ref={fade} className="flex flex-col items-center gap-3 text-center">
                <p className={`eyebrow flex items-center gap-2 ${s.text}`} style={vars(T.eyebrow)}>
                  <span className={`bg-brand size-1.5 rounded-full ${s.led}`} style={vars(T.eyebrow)} />
                  Inventory · Projects · Teams
                </p>
                <p
                  className={`font-display text-2xl font-semibold tracking-tight text-balance sm:text-4xl ${s.text}`}
                  style={vars(T.greet)}
                >
                  <span className={s.morning}>{GREETING.morning}</span>
                  <span className={s.afternoon}>{GREETING.afternoon}</span>
                  <span className={s.evening}>{GREETING.evening}</span> — welcome to TEC
                </p>
              </div>
            </div>
          </div>
          <p role="status" className="sr-only">
            {announce}
          </p>
          <button
            type="button"
            className={`eyebrow border-border bg-background/80 text-foreground hover:border-foreground/40 focus-visible:ring-ring absolute right-4 bottom-4 flex h-11 items-center gap-2 rounded-md border px-3 outline-none focus-visible:ring-2 sm:right-6 sm:bottom-6 sm:h-9 ${s.skip}`}
          >
            Skip intro
            <kbd className="text-muted-foreground font-mono">Esc</kbd>
          </button>
        </div>
      )}
    </>
  )
}

/** The logo with every layer wired to the timeline. Its final frame is identical to <TecLogo>. */
function IntroLogo({ ref }: { ref: Ref<SVGSVGElement> }) {
  const { x, y, w, h } = VIEWBOX
  const id = "tec-intro-"
  const pulse = { d: PULSE, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", pathLength: 1 } as const
  return (
    <svg ref={ref} viewBox={`${x} ${y} ${w} ${h}`} className={s.logo}>
      <LogoDefs id={id} halo={{ pathLength: 1, className: s.draw, style: vars(T.pulse, T.pulseDur) }} />
      <filter id={`${id}blur`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <g mask={`url(#${id}h)`}>
        <path d={BLOCK_TE} fill="currentColor" className={s.block} style={vars(T.te)} />
        <g className={s.block} style={vars(T.c)}>
          <path d={BLOCK_C} fill="currentColor" />
          <g clipPath={`url(#${id}c)`} className="fill-(--logo-trace) stroke-(--logo-trace)" strokeLinecap="round">
            <path d={ALL_TRACES} fill="none" strokeWidth={3.2} className={s.traceDim} />
            {SEGMENTS.map((t) => (
              <path key={t.d} d={t.d} fill="none" strokeWidth={t.w} pathLength={1} className={s.trace} style={vars(t.delay, t.dur)} />
            ))}
            {PADS.map(([cx, cy, r], i) => (
              <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} stroke="none" className={s.pad} style={vars(PAD_DELAYS[i])} />
            ))}
          </g>
        </g>
      </g>
      <g className="stroke-brand">
        <path {...pulse} strokeWidth={32} filter={`url(#${id}blur)`} className={s.glow} style={vars(T.pulse, T.pulseDur)} />
        <path {...pulse} strokeWidth={PULSE_WIDTH} className={s.draw} style={vars(T.pulse, T.pulseDur)} />
        <path {...pulse} strokeWidth={64} opacity={0.45} filter={`url(#${id}blur)`} className={s.dot} style={vars(T.pulse, T.pulseDur)} />
        <path {...pulse} strokeWidth={22} className={`${s.dot} ${s.dotCore}`} style={vars(T.pulse, T.pulseDur)} />
      </g>
    </svg>
  )
}

// Runs during HTML parsing on hard loads; inert (text/plain) when React renders it on the client. See Next's
// "Preventing flash before hydration" guide.
function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
