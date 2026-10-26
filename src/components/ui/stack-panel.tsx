"use client"

// Vendored: it reads the panel ref while rendering and positions the flying title through the animate scope's
// element, both on purpose; the React Compiler lint rules flag those patterns.
/* eslint-disable react-hooks/refs, react-hooks/immutability */

/**
 * Stack Panel, adapted from KokonutUI (@dorianbaffier, MIT, https://kokonutui.com).
 * A panel that drills into pages, like settings on a phone: a row opens its page from the right while its label
 * flies up to become the title; swipe the page right, or press Back or Escape, to return.
 * Local changes: app colour tokens, and a page can carry a `body` (any content, e.g. a form) under its rows.
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  type PanInfo,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { cn } from "@/lib/utils"

export interface StackRow {
  id: string
  label: string
  /** Grey text on the right, like the current value of a setting. */
  detail?: string
  /** Id of the page this row opens. */
  to?: string
  /** Anything else on the right: a switch, a badge. */
  trailing?: ReactNode
  onSelect?: () => void
  /** Shows a check, for rows that pick one option of a section. */
  selected?: boolean
  tone?: "default" | "danger"
}

export interface StackSection {
  title?: string
  rows: StackRow[]
  /** Small print under the section. */
  footer?: string
}

export interface StackPage {
  title: string
  sections?: StackSection[]
  /** Free content under the rows (a form, a description). */
  body?: ReactNode
}

export interface StackPanelProps {
  pages: Record<string, StackPage>
  /** The page the panel starts on. */
  root: string
  className?: string
}

// iOS pushes with a curve close to this; the page settles without bounce.
const PUSH = { type: "spring", duration: 0.42, bounce: 0 } as const
const HEIGHT = { type: "spring", duration: 0.38, bounce: 0 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const
// The page underneath moves a third as far as the one on top.
const PARALLAX = 0.3
// Let go past this share of the width, or flick faster, and the page pops.
const POP_DISTANCE = 0.35
const POP_VELOCITY = 500

interface Origin {
  /** The tapped row's label, relative to the panel. */
  left: number
  top: number
  height: number
  fontSize: number
}

/** The header title. Pushed in from a row, it flies from that row's label up into the header; otherwise it slides and fades. */
function Title({ text, origin, direction, panel }: { text: string; origin: Origin | null; direction: 1 | -1; panel: HTMLElement | null }) {
  const [scope, run] = useAnimate<HTMLSpanElement>()
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const el = scope.current
    if (!(el && panel)) return
    if (!origin || reduced) {
      run(el, { opacity: [0, 1], x: [direction * 24, 0] }, { duration: reduced ? 0 : 0.28, ease: EASE_OUT })
      return
    }
    const box = panel.getBoundingClientRect()
    const own = el.getBoundingClientRect()
    const fontSize = Number.parseFloat(getComputedStyle(el).fontSize)
    const scale = origin.fontSize / fontSize
    const dx = origin.left - (own.left - box.left)
    const dy = origin.top + origin.height / 2 - (own.top - box.top + own.height / 2)
    // Placed at the row before the first frame, so it never flashes in the header first.
    el.style.transform = `translateX(${dx}px) translateY(${dy}px) scale(${scale})`
    run(el, { x: [dx, 0], y: [dy, 0], scale: [scale, 1], opacity: [1, 1] }, PUSH)
  }, [scope, run, origin, direction, panel, reduced])

  return (
    <motion.span
      className="text-foreground absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[55%] -translate-y-1/2 truncate text-[15px] font-semibold"
      exit={{ opacity: 0, x: direction * -40, transition: { duration: 0.18, ease: EASE_OUT } }}
      ref={scope}
      style={{ transformOrigin: "left center" }}
    >
      {text}
    </motion.span>
  )
}

function Page({
  page,
  onOpen,
  measureRef,
}: {
  page: StackPage
  onOpen: (row: StackRow, label: HTMLElement) => void
  measureRef?: (el: HTMLDivElement | null) => void
}) {
  return (
    <div className="flex flex-col gap-5 px-3 pt-3 pb-4" ref={measureRef}>
      {page.sections?.map((section, index) => (
        <section key={index}>
          {section.title && <h3 className="text-muted-foreground mb-1.5 px-3 text-xs font-medium">{section.title}</h3>}
          <ul className="bg-muted/60 divide-border/70 divide-y overflow-hidden rounded-xl">
            {section.rows.map((row) => (
              <li key={row.id}>
                <RowView onOpen={onOpen} row={row} />
              </li>
            ))}
          </ul>
          {section.footer && <p className="text-muted-foreground mt-1.5 px-3 text-xs leading-5">{section.footer}</p>}
        </section>
      ))}
      {page.body}
    </div>
  )
}

function RowView({ row, onOpen }: { row: StackRow; onOpen: (row: StackRow, label: HTMLElement) => void }) {
  const labelRef = useRef<HTMLSpanElement>(null)
  const interactive = Boolean(row.to || row.onSelect)
  const content = (
    <>
      <span
        className={cn("min-w-0 flex-1 truncate text-left text-[15px]", row.tone === "danger" ? "text-danger" : "text-foreground")}
        ref={labelRef}
      >
        {row.label}
      </span>
      {row.detail && <span className="text-muted-foreground max-w-[55%] shrink-0 truncate text-sm">{row.detail}</span>}
      {row.trailing}
      {row.selected !== undefined && (
        <Check aria-hidden="true" className={cn("text-foreground size-4 shrink-0", !row.selected && "invisible")} />
      )}
      {row.to && <ChevronRight aria-hidden="true" className="text-muted-foreground -mr-1 size-4 shrink-0" />}
    </>
  )
  const base = "flex min-h-11 w-full items-center gap-2 px-3 py-2"
  if (!interactive) return <div className={base}>{content}</div>
  return (
    <button
      aria-pressed={row.selected}
      className={cn(base, "hover:bg-muted focus-visible:bg-muted active:bg-muted outline-none transition-colors duration-150")}
      data-row={row.id}
      onClick={() => labelRef.current && onOpen(row, labelRef.current)}
      type="button"
    >
      {content}
    </button>
  )
}

export function StackPanel({ pages, root, className }: StackPanelProps) {
  const [stack, setStack] = useState<string[]>([root])
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)
  // "auto" until the first page is measured, so the server render has a height too.
  const [height, setHeight] = useState<number | "auto">("auto")
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const observer = useRef<ResizeObserver | null>(null)
  // The row that opened each page, so Back can hand focus to it again.
  const openers = useRef<string[]>([])
  // The top page's offset; the page underneath is derived from it, so a push, a pop and a swipe move both together.
  const x = useMotionValue(0)
  const [width, setWidth] = useState(360)
  const underX = useTransform(x, (v) => -PARALLAX * (width - v))
  const shade = useTransform(x, [0, width], [0.06, 0])

  const top = stack.at(-1) ?? root
  const under = stack.length > 1 ? stack.at(-2) : undefined
  const parent = under ? pages[under] : undefined

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const watch = new ResizeObserver(() => setWidth(body.clientWidth))
    watch.observe(body)
    return () => {
      watch.disconnect()
      observer.current?.disconnect()
    }
  }, [])

  // The panel's height follows the page on top.
  const measure = (el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.current.observe(el)
  }

  const push = (row: StackRow, label: HTMLElement) => {
    row.onSelect?.()
    if (!(row.to && pages[row.to]) || busy) return
    const box = panelRef.current?.getBoundingClientRect()
    const rect = label.getBoundingClientRect()
    setOrigin(
      box
        ? { left: rect.left - box.left, top: rect.top - box.top, height: rect.height, fontSize: Number.parseFloat(getComputedStyle(label).fontSize) }
        : null
    )
    setDirection(1)
    setBusy(true)
    x.set(width)
    const to = row.to
    openers.current.push(row.id)
    flushSync(() => setStack((s) => [...s, to]))
    animate(x, 0, PUSH).then(() => setBusy(false))
    backRef.current?.focus({ preventScroll: true })
  }

  const pop = () => {
    if (stack.length < 2 || busy) return
    setOrigin(null)
    setDirection(-1)
    setBusy(true)
    const opener = openers.current.pop()
    const hadFocus = panelRef.current?.contains(document.activeElement)
    animate(x, width, { ...PUSH, duration: 0.34 }).then(() => {
      // Both in one frame: the old top unmounts as the offset resets.
      flushSync(() => setStack((s) => s.slice(0, -1)))
      x.set(0)
      setBusy(false)
      // The focused Back button or row just unmounted; land on the row that opened the page instead.
      if (hadFocus && opener) {
        const rows = bodyRef.current?.querySelectorAll<HTMLElement>(`[data-row="${CSS.escape(opener)}"]`)
        ;[...(rows ?? [])].find((el) => !el.closest("[inert]"))?.focus({ preventScroll: true })
      }
    })
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (x.get() > width * POP_DISTANCE || info.velocity.x > POP_VELOCITY) pop()
    else animate(x, 0, PUSH)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Escape inside a form field belongs to the field (and Radix menus), not to the panel.
    if (event.key === "Escape" && stack.length > 1 && !(event.target as HTMLElement).closest("input, textarea, [role=listbox]")) {
      event.preventDefault()
      pop()
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("bg-card relative w-full overflow-hidden rounded-2xl border", className)} onKeyDown={onKeyDown} ref={panelRef}>
        <div className="bg-card relative z-10 flex h-12 items-center border-b px-2">
          <AnimatePresence initial={false}>
            {parent && (
              <motion.button
                animate={{ opacity: 1 }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 relative z-10 flex max-w-[30%] items-center rounded-lg py-1.5 pr-2 pl-1 text-sm outline-none transition-colors duration-150 focus-visible:ring-2"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="back"
                onClick={pop}
                ref={backRef}
                transition={{ duration: 0.18 }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{parent.title}</span>
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            <Title direction={direction} key={`${top}-${stack.length}`} origin={origin} panel={panelRef.current} text={pages[top]?.title ?? ""} />
          </AnimatePresence>
        </div>

        <motion.div animate={{ height }} className="relative" ref={bodyRef} transition={HEIGHT}>
          {under && pages[under] && (
            <motion.div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" inert key={`${under}-${stack.length - 1}`} style={{ x: underX }}>
              <Page onOpen={() => undefined} page={pages[under]} />
              <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
            </motion.div>
          )}
          {pages[top] && (
            <motion.div
              className="bg-card relative"
              // Pages with a body hold forms, where a sideways drag would fight text selection.
              drag={stack.length > 1 && !busy && !pages[top].body ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragDirectionLock
              dragElastic={{ left: 0, right: 1 }}
              dragMomentum={false}
              key={`${top}-${stack.length}`}
              onDragEnd={onDragEnd}
              style={{ x, boxShadow: stack.length > 1 ? "-8px 0 24px -12px rgb(0 0 0 / 0.18)" : "" }}
            >
              <Page measureRef={measure} onOpen={push} page={pages[top]} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </MotionConfig>
  )
}
