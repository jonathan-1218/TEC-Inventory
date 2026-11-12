"use client"

/**
 * Scroll Index, adapted from KokonutUI (@dorianbaffier, MIT, https://kokonutui.com) for a whole page: a slim
 * rail fixed to the right edge with one tick per `[data-index]` element, placed where that element sits in the
 * page's scroll. A head shows where you are between ticks; hovering swells nearby ticks like a dock and names the
 * section; click a tick to glide there, drag the rail to scrub the page, or use the arrow keys.
 * Local changes: indexes the document (no wrapper), reads labels from data-index, and sits on a small dark pill
 * so it reads over both the dark and the cream sections.
 */

import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Marks each tick ahead, current or passed, and keeps one tab stop. */
function markTicks(ticks: (HTMLButtonElement | null)[], active: number) {
  ticks.forEach((tick, i) => {
    if (!tick) return
    tick.dataset.state = i === active ? "current" : i < active ? "passed" : "ahead"
    tick.tabIndex = i === Math.max(active, 0) ? 0 : -1
    if (i === active) tick.setAttribute("aria-current", "location")
    else tick.removeAttribute("aria-current")
  })
}

interface Section {
  el: HTMLElement
  text: string
  /** Scroll position that brings the section to the top. */
  at: number
  /** Where its tick sits on the rail, 0 to 1. */
  pos: number
}

// Rail height in px; ticks sit at the scroll position of their section, so long sections leave long gaps.
const RAIL = 220
// Ticks swell near the pointer like a dock: peak width and reach, in px.
const SWELL = 1.6
const REACH = 26
// A drag let go this close to a tick (after its momentum) settles on it.
const SNAP = 18
// How long the flashed section name stays up after scrolling into it.
const FLASH = 900

function easeInOut(t: number) {
  return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2
}

export default function ScrollIndex({ selector = "[data-index]", className }: { selector?: string; className?: string }) {
  const railRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [sections, setSections] = useState<{ text: string; pos: number }[]>([])
  // The effect below reads and writes these without re-rendering.
  const api = useRef<{ jump: (index: number) => void; show: (i: number) => void }>({ jump: () => undefined, show: () => undefined })

  useEffect(() => {
    const rail = railRef.current
    const head = headRef.current
    const label = labelRef.current
    if (!(rail && head && label)) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let list: Section[] = []
    let end = 1
    let active = -1
    let height = RAIL
    let raf = 0
    let tween = 0
    let flashTimer = 0
    let painted = false
    let hover: number | null = null
    let drag: { id: number; moved: boolean; y: number; t: number; v: number } | null = null
    const swell: number[] = []

    const measure = () => {
      const scroll = window.scrollY
      end = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      list = Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => {
        const at = Math.min(Math.max(el.getBoundingClientRect().top + scroll, 0), end)
        return { el, text: el.dataset.index || el.textContent?.trim() || "", at, pos: at / end }
      })
      height = rail.clientHeight || RAIL
      setSections(list.map(({ text, pos }) => ({ text, pos })))
    }

    const fraction = () => Math.min(Math.max(window.scrollY / end, 0), 1)

    const nearest = (y: number) => {
      let best = -1
      let distance = Number.POSITIVE_INFINITY
      list.forEach((s, i) => {
        const d = Math.abs(s.pos * height - y)
        if (d < distance) {
          distance = d
          best = i
        }
      })
      return { index: best, distance }
    }

    const placeLabel = (index: number, visible: boolean) => {
      const section = list[index]
      if (!section) {
        label.style.opacity = "0"
        return
      }
      if (label.textContent !== section.text) label.textContent = section.text
      label.style.transform = `translate3d(0, ${(section.pos * height).toFixed(1)}px, 0) translateY(-50%)`
      label.style.opacity = visible ? "1" : "0"
    }

    /** Section the reader is in: the last one whose top is at or above the viewport's top. */
    const current = () => {
      const scroll = window.scrollY + 1
      let index = -1
      for (let i = 0; i < list.length; i++) if (list[i].at <= scroll) index = i
      return index
    }

    const paint = () => {
      raf = 0
      head.style.transform = `translate3d(0, ${(fraction() * height).toFixed(1)}px, 0)`
      const now = current()
      if (now !== active) {
        active = now
        markTicks(tickRefs.current, active)
        // Scrolling into a new section names it briefly.
        if (painted && hover === null && !drag && active >= 0) {
          placeLabel(active, true)
          window.clearTimeout(flashTimer)
          flashTimer = window.setTimeout(() => {
            if (hover === null && !drag) label.style.opacity = "0"
          }, FLASH)
        }
      }
      // Ticks ease toward their swell, so the magnification follows the pointer smoothly.
      let moving = false
      tickRefs.current.forEach((tick, i) => {
        if (!tick) return
        const y = (list[i]?.pos ?? 0) * height
        const target = hover === null || reduceMotion ? 1 : 1 + SWELL * Math.exp(-((hover - y) ** 2) / (2 * REACH * REACH))
        const value = (swell[i] ?? 1) + (target - (swell[i] ?? 1)) * 0.35
        swell[i] = Math.abs(value - target) < 0.005 ? target : value
        moving ||= swell[i] !== target
        tick.style.setProperty("--swell", swell[i].toFixed(3))
      })
      painted = true
      if (moving) schedule()
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(paint)
    }

    const stopTween = () => {
      cancelAnimationFrame(tween)
      tween = 0
    }

    const scrollTo = (target: number) => {
      stopTween()
      const from = window.scrollY
      const to = Math.min(Math.max(target, 0), end)
      if (reduceMotion || Math.abs(to - from) < 2) return window.scrollTo(0, to)
      // Long jumps on this page cross several pinned scenes, so they get a little more time than the original.
      const duration = Math.min(Math.max(320 + Math.abs(to - from) * 0.05, 400), 1100)
      const begin = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - begin) / duration, 1)
        window.scrollTo(0, from + (to - from) * easeInOut(t))
        tween = t < 1 ? requestAnimationFrame(step) : 0
      }
      tween = requestAnimationFrame(step)
    }

    api.current = {
      jump: (index) => {
        const section = list[index]
        if (section) scrollTo(section.at)
      },
      show: (index) => {
        hover = (list[index]?.pos ?? 0) * height
        placeLabel(index, true)
        schedule()
      },
    }

    const railY = (event: PointerEvent) => Math.min(Math.max(event.clientY - rail.getBoundingClientRect().top, 0), height)

    const onDown = (event: PointerEvent) => {
      if (drag || event.button !== 0) return
      event.preventDefault()
      rail.setPointerCapture(event.pointerId)
      stopTween()
      const y = railY(event)
      drag = { id: event.pointerId, moved: false, y, t: event.timeStamp, v: 0 }
      hover = y
      rail.dataset.dragging = ""
      placeLabel(nearest(y).index, true)
      schedule()
    }

    const onMove = (event: PointerEvent) => {
      const y = railY(event)
      if (drag && event.pointerId === drag.id) {
        const dt = Math.max(event.timeStamp - drag.t, 1)
        drag.v = drag.v * 0.4 + ((y - drag.y) / dt) * 0.6
        drag.moved ||= Math.abs(y - drag.y) > 3
        drag.y = y
        drag.t = event.timeStamp
        // Dragging the rail scrubs the page under it.
        if (drag.moved) window.scrollTo(0, (y / height) * end)
      } else if (event.pointerType !== "mouse") {
        return
      }
      hover = y
      placeLabel(nearest(y).index, true)
      schedule()
    }

    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const { moved, y, v } = drag
      drag = null
      delete rail.dataset.dragging
      if (event.pointerType !== "mouse") {
        hover = null
        placeLabel(-1, false)
      }
      // Where the flick was heading, then the tick nearest that.
      const hit = nearest(moved ? y + v * 120 : y)
      if (hit.index >= 0 && (!moved || hit.distance < SNAP)) api.current.jump(hit.index)
      schedule()
    }

    const onLeave = () => {
      if (drag) return
      hover = null
      placeLabel(-1, false)
      schedule()
    }

    const onScroll = () => schedule()
    // Any scroll input of the reader's own cancels a jump in progress.
    const onInput = () => stopTween()

    measure()
    paint()
    const resize = new ResizeObserver(() => {
      measure()
      schedule()
    })
    resize.observe(document.body)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("wheel", onInput, { passive: true })
    window.addEventListener("touchstart", onInput, { passive: true })
    rail.addEventListener("pointerdown", onDown)
    rail.addEventListener("pointermove", onMove)
    rail.addEventListener("pointerup", onUp)
    rail.addEventListener("pointercancel", onUp)
    rail.addEventListener("pointerleave", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      stopTween()
      window.clearTimeout(flashTimer)
      resize.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("wheel", onInput)
      window.removeEventListener("touchstart", onInput)
      rail.removeEventListener("pointerdown", onDown)
      rail.removeEventListener("pointermove", onMove)
      rail.removeEventListener("pointerup", onUp)
      rail.removeEventListener("pointercancel", onUp)
      rail.removeEventListener("pointerleave", onLeave)
    }
  }, [selector])

  const onTickKey = (index: number, event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    tickRefs.current[Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), sections.length - 1)]?.focus()
  }

  return (
    <nav
      aria-label="Sections"
      className={cn(
        "fixed top-1/2 right-4 z-[75] -translate-y-1/2 rounded-full bg-[rgba(14,13,11,.5)] px-2 py-3 opacity-60 backdrop-blur-sm transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100",
        className
      )}
    >
      <div className="relative w-6 cursor-pointer touch-none select-none data-[dragging]:cursor-grabbing" ref={railRef} style={{ height: RAIL }}>
        {sections.map((section, index) => (
          <button
            aria-label={section.text}
            className="absolute right-0 h-4 w-3.5 -translate-y-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#e99704]"
            data-state="ahead"
            key={`${index}-${section.text}`}
            onBlur={() => labelRef.current?.style.setProperty("opacity", "0")}
            // Pointer clicks are handled by the rail; this is the keyboard.
            onClick={(event) => event.detail === 0 && api.current.jump(index)}
            onFocus={() => api.current.show(index)}
            onKeyDown={(event) => onTickKey(index, event)}
            ref={(el) => {
              tickRefs.current[index] = el
            }}
            style={{ top: `${(section.pos * 100).toFixed(3)}%` }}
            tabIndex={index === 0 ? 0 : -1}
            type="button"
          >
            <span className="absolute top-1/2 right-0 h-[1.5px] w-full origin-right -translate-y-1/2 scale-x-[var(--swell,1)] rounded-full bg-[#5a574f] transition-colors duration-200 ease-out in-data-[state=current]:bg-[#e99704] in-data-[state=passed]:bg-[#f2f0ea]" />
          </button>
        ))}
        {/* Where the reader is, between ticks too. */}
        <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 h-[2px] w-6 -translate-y-1/2 rounded-full bg-[#f2f0ea] will-change-transform" ref={headRef} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-9 rounded-md border border-[#2a2823] bg-[#14130f] px-2 py-1 font-mono text-[11px] tracking-[.12em] whitespace-nowrap text-[#f2f0ea] uppercase opacity-0 shadow-sm transition-[opacity,transform] duration-150 ease-out"
          ref={labelRef}
        />
      </div>
    </nav>
  )
}
