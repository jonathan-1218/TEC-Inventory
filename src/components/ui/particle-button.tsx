"use client"

/**
 * Particle Button, adapted from KokonutUI (@dorianbaffier, MIT, https://kokonutui.com).
 * A status button for async actions: the label crossfades to a spinner, then to a drawn check with a burst of
 * particles, or to an error with a shake. The width follows every label.
 * Local changes: the app's danger colour, and `useActionStatus` to drive it from a form's server action.
 */

// Burst keeps its onDone callback in a ref updated during render, on purpose.
/* eslint-disable react-hooks/refs */

import type { VariantProps } from "class-variance-authority"
import { AlertCircle } from "lucide-react"
import { AnimatePresence, MotionConfig, motion, useAnimationControls, useReducedMotion } from "motion/react"
import { type ComponentProps, type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ParticleButtonStatus = "idle" | "pending" | "success" | "error"

export interface ParticleButtonProps
  extends Omit<ComponentProps<"button">, "onClick" | "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart">,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode
  /** Return a promise to show the pending state until it settles. A rejected promise shows the error state. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown
  onSuccess?: () => void
  onError?: (error: unknown) => void
  /** Controlled status. Without it the button tracks `onClick` itself. */
  status?: ParticleButtonStatus
  successDuration?: number
  errorDuration?: number
  pendingLabel?: ReactNode
  successLabel?: ReactNode
  errorLabel?: ReactNode
  /** Icon rendered after the idle label. */
  icon?: ReactNode
  /** Fire the particle burst on success. */
  particles?: boolean
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const LABEL_TRANSITION = { duration: 0.2, ease: EASE_OUT }
const WIDTH_TRANSITION = { type: "spring", duration: 0.35, bounce: 0 } as const
const SHAKE = { x: [0, -5, 5, -3, 3, 0] }
// A computed color with zero alpha: rgba(0, 0, 0, 0) or oklch(… / 0).
const ZERO_ALPHA = /(,|\/)\s*0\)$/

// --- Particles ---

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  w: number
  h: number
}

const PARTICLE_COUNT = 18
const GRAVITY = 0.0016 // px per ms²
const DRAG = 0.0022 // fraction of velocity lost per ms
const LIFETIME = 650
const BLEED = 64 // room around the button the canvas can draw into

function createParticles(originX: number, width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Spread across the top edge, biased toward the press point.
    const spread = (Math.random() - 0.5) * Math.min(width, 120)
    const x = Math.min(Math.max(originX + spread, 4), width - 4)
    const side = x < width / 2 ? -1 : 1
    const speed = 0.18 + Math.random() * 0.22
    const angle = -Math.PI / 2 + side * Math.random() * 0.9
    const isChip = i % 3 === 0
    return {
      x,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.02,
      w: isChip ? 5 : 3,
      h: isChip ? 2 : 3,
    }
  })
}

/** Small chips of the button's own color fly off its top edge with gravity, drag and spin, on one short-lived canvas. */
function Burst({ originX, color, onDone }: { originX: number; color: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const parent = canvas?.parentElement?.parentElement
    if (!(canvas && ctx && parent)) return
    const dpr = window.devicePixelRatio || 1
    const width = parent.offsetWidth
    const cssW = width + BLEED * 2
    const cssH = parent.offsetHeight + BLEED * 2
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
    ctx.scale(dpr, dpr)

    const particles = createParticles(originX, width)
    const start = performance.now()
    let last = start
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(now - last, 32)
      last = now
      const t = (now - start) / LIFETIME
      ctx.clearRect(0, 0, cssW, cssH)
      if (t >= 1) return onDoneRef.current()
      ctx.fillStyle = color
      ctx.globalAlpha = 1 - t * t
      for (const p of particles) {
        p.vx *= 1 - DRAG * dt
        p.vy = p.vy * (1 - DRAG * dt) + GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        ctx.save()
        ctx.translate(p.x + BLEED, p.y + BLEED)
        ctx.rotate(p.angle)
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [originX, color])

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ top: -BLEED, left: -BLEED, width: `calc(100% + ${BLEED * 2}px)`, height: `calc(100% + ${BLEED * 2}px)` }}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </span>
  )
}

// --- Icons ---

function Spinner() {
  return (
    <svg aria-hidden="true" className="animate-spin [animation-duration:700ms]" fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" opacity="0.25" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function Check() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={{ pathLength: 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ duration: 0.3, delay: 0.08, ease: EASE_OUT }}
      />
    </svg>
  )
}

// --- Button ---

// Chips take the button's fill; outline, ghost and link buttons have none, so those burst in the text color.
function burstColor(button: HTMLElement) {
  const style = getComputedStyle(button)
  const fill = style.backgroundColor
  return fill === "transparent" || ZERO_ALPHA.test(fill) ? style.color : fill
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as PromiseLike<unknown>).then === "function"
}

export default function ParticleButton({
  children = "Save changes",
  onClick,
  onSuccess,
  onError,
  status: controlledStatus,
  successDuration = 1600,
  errorDuration = 3200,
  pendingLabel = "Saving",
  successLabel = "Saved",
  errorLabel = "Try again",
  icon,
  particles = true,
  variant,
  size,
  className,
  disabled,
  ...props
}: ParticleButtonProps) {
  const [internalStatus, setInternalStatus] = useState<ParticleButtonStatus>("idle")
  const status = controlledStatus ?? internalStatus
  const [burst, setBurst] = useState<{ id: number; originX: number; color: string } | null>(null)
  const [width, setWidth] = useState<number | undefined>()

  const buttonRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const pressXRef = useRef<number | null>(null)
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runRef = useRef(0)
  const previousStatusRef = useRef(status)
  const shake = useAnimationControls()
  const shouldReduceMotion = useReducedMotion()

  useEffect(
    () => () => {
      if (resetRef.current) clearTimeout(resetRef.current)
    },
    []
  )

  // The width follows the entering label (measured on every change) with a spring, so it never jumps.
  useLayoutEffect(() => {
    const button = buttonRef.current
    const content = contentRef.current
    if (!(button && content)) return
    const measure = () => {
      const labels = content.querySelectorAll<HTMLElement>(`[data-label="${status}"]`)
      const label = labels.item(labels.length - 1)
      if (!label) return
      const style = getComputedStyle(button)
      const chrome =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight) +
        Number.parseFloat(style.borderLeftWidth) +
        Number.parseFloat(style.borderRightWidth)
      setWidth(Math.ceil(label.scrollWidth + chrome))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [status])

  // Success fires the burst and error shakes, whether the status came from `onClick` or from the `status` prop.
  useEffect(() => {
    const previous = previousStatusRef.current
    previousStatusRef.current = status
    if (previous === status) return
    const button = buttonRef.current
    if (status === "success" && particles && !shouldReduceMotion && button) {
      setBurst({ id: Date.now(), originX: pressXRef.current ?? button.offsetWidth / 2, color: burstColor(button) })
    }
    if (status === "error" && !shouldReduceMotion) shake.start(SHAKE, { duration: 0.32, ease: "easeOut" })
  }, [status, particles, shouldReduceMotion, shake])

  const settle = (next: "success" | "error") => {
    setInternalStatus(next)
    resetRef.current = setTimeout(
      () => {
        setInternalStatus("idle")
        resetRef.current = null
      },
      next === "success" ? successDuration : errorDuration
    )
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (status === "pending") {
      // A submit button must not resubmit its form while the last save is still running.
      event.preventDefault()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    // Keyboard clicks report 0,0, so they burst from the center.
    pressXRef.current = event.clientX === 0 && event.clientY === 0 ? null : event.clientX - rect.left
    if (resetRef.current) {
      clearTimeout(resetRef.current)
      resetRef.current = null
    }
    const result = onClick?.(event)
    if (event.defaultPrevented || controlledStatus !== undefined) return
    if (!isPromiseLike(result)) {
      settle("success")
      onSuccess?.()
      return
    }
    runRef.current += 1
    const run = runRef.current
    setInternalStatus("pending")
    Promise.resolve(result).then(
      () => {
        if (run === runRef.current) {
          settle("success")
          onSuccess?.()
        }
      },
      (error: unknown) => {
        if (run === runRef.current) {
          settle("error")
          onError?.(error)
        }
      }
    )
  }

  const label =
    status === "pending" ? (
      <>
        <Spinner />
        {pendingLabel}
      </>
    ) : status === "success" ? (
      <>
        <Check />
        {successLabel}
      </>
    ) : status === "error" ? (
      <>
        <AlertCircle aria-hidden="true" />
        {errorLabel}
      </>
    ) : (
      <>
        {children}
        {icon}
      </>
    )

  return (
    <MotionConfig reducedMotion="user">
      {/* Outside the button, so it isn't read twice as part of its name. */}
      <span aria-live="polite" className="sr-only">
        {status === "pending" && pendingLabel}
        {status === "success" && successLabel}
        {status === "error" && errorLabel}
      </span>
      <motion.button
        animate={width === undefined ? undefined : { width }}
        aria-busy={status === "pending" || undefined}
        aria-disabled={status === "pending" || undefined}
        className={cn(
          buttonVariants({ variant, size }),
          "group/status relative overflow-visible",
          "transition-[background-color,color,opacity] duration-200 ease-out",
          status === "error" && "bg-danger hover:bg-danger/90 text-white",
          className
        )}
        data-status={status}
        disabled={disabled}
        onClick={handleClick}
        ref={buttonRef}
        transition={shouldReduceMotion ? { duration: 0 } : WIDTH_TRANSITION}
        type="button"
        {...props}
      >
        {burst && <Burst color={burst.color} key={burst.id} onDone={() => setBurst(null)} originX={burst.originX} />}
        {/* Clips the sliding labels to the button's box while the canvas can still overflow. */}
        <motion.span animate={shake} className="relative -my-2 flex items-center justify-center self-stretch overflow-hidden py-2" ref={contentRef}>
          {/* The entering label keeps its place in the flow (and so the measured width); the leaving one floats out. */}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
              data-label={status}
              exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
              key={status}
              transition={LABEL_TRANSITION}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </motion.button>
    </MotionConfig>
  )
}

/**
 * Drives a ParticleButton from a form's server action: `track(runAction(...))` shows the spinner, then the check
 * and burst (resolving once it has played, so a dialog can close on a finished animation) or the error shake.
 */
export function useActionStatus() {
  const [status, setStatus] = useState<ParticleButtonStatus>("idle")
  const reduced = useReducedMotion()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const track = async <R extends { ok: boolean }>(promise: Promise<R>): Promise<R> => {
    if (timer.current) clearTimeout(timer.current)
    setStatus("pending")
    const res = await promise
    if (res.ok) {
      setStatus("success")
      await new Promise((done) => setTimeout(done, reduced ? 0 : 850))
      setStatus("idle")
    } else {
      setStatus("error")
      timer.current = setTimeout(() => setStatus("idle"), 2400)
    }
    return res
  }
  return [status, track] as const
}
