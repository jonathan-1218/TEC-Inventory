"use client"

/**
 * Team Selector, adapted from KokonutUI (@dorianbaffier, MIT, https://kokonutui.com): a seat counter with an
 * avatar stack, +/− buttons that shake at a bound, a number you can scrub sideways, and arrow-key support.
 * Local changes: the pricing line is removed and colours use the app's tokens.
 */

import { Minus, Plus } from "lucide-react"
import { AnimatePresence, animate, MotionConfig, motion, useMotionValue, useReducedMotion, type Variants } from "motion/react"
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Horizontal pixels of drag per step when scrubbing the number. */
const SCRUB_STEP_PX = 24
/** Furthest the number stretches past a bound, however far you pull. */
const RUBBER_BAND_PX = 14
/** Avatars shown before the stack collapses into a "+N" chip. */
const VISIBLE_AVATARS = 5
const AVATAR_OVERLAP = 8
const ROLL_DISTANCE = 10
const SHAKE_DURATION_MS = 280
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const SNAP_BACK = { type: "spring", stiffness: 600, damping: 32 } as const

export interface TeamMember {
  id: string
  name: string
}

interface Seat extends TeamMember {
  isOpen: boolean
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

/** Stable hue per name, so the same person always gets the same tint. */
const getHue = (name: string) => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 3_600_000
  return hash % 360
}

const animations = {
  avatar: {
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 28, mass: 0.6 } },
    hidden: { opacity: 0, scale: 0.85, transition: { duration: 0.16, ease: EASE_OUT } },
  } satisfies Variants,
  vibration: {
    idle: { x: 0 },
    shake: { x: [-3, 3, -2, 2, 0] as const, transition: { duration: SHAKE_DURATION_MS / 1000, ease: EASE_OUT } },
  } satisfies Variants,
  // `custom` is the signed offset of the latest change, so leaving digits exit opposite to the ones coming in.
  roll: {
    enter: (offset: number) => ({ opacity: 0, y: offset }),
    center: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
    exit: (offset: number) => ({ opacity: 0, y: -offset, transition: { duration: 0.12, ease: EASE_OUT } }),
  } satisfies Variants,
} as const

/** Rolls each digit on its own, keyed by its place from the right, so 9 → 10 grows a new tens column. */
function RollingText({ text, offset, className }: { text: string; offset: number; className?: string }) {
  const columns = [...text].map((char, index, all) => ({ char, place: all.length - index }))
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      <AnimatePresence custom={offset} initial={false} mode="popLayout">
        {columns.map(({ char, place }) => (
          <motion.span
            animate="center"
            className="relative inline-flex overflow-hidden"
            custom={offset}
            exit="exit"
            initial="enter"
            key={`place-${place}`}
            variants={animations.roll}
          >
            <AnimatePresence custom={offset} initial={false} mode="popLayout">
              <motion.span animate="center" className="inline-block" custom={offset} exit="exit" initial="enter" key={char} variants={animations.roll}>
                {char}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  )
}

function SeatAvatar({ seat, index }: { seat: Seat; index: number }) {
  const base = "ring-card flex size-10 items-center justify-center overflow-hidden rounded-full ring-2"
  if (seat.isOpen) {
    return (
      <span className={cn(base, "bg-card text-muted-foreground outline-border text-[11px] font-medium tabular-nums outline-1 -outline-offset-3 outline-dashed")}>
        {index + 1}
      </span>
    )
  }
  return (
    <span
      className={cn(
        base,
        "bg-[oklch(0.94_0.025_var(--hue))] text-[12px] font-medium text-[oklch(0.42_0.05_var(--hue))] dark:bg-[oklch(0.32_0.03_var(--hue))] dark:text-[oklch(0.86_0.04_var(--hue))]"
      )}
      style={{ "--hue": getHue(seat.name) } as CSSProperties}
    >
      {getInitials(seat.name)}
    </span>
  )
}

const STEPPER =
  "bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 active:bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl border transition-[color,background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-not-allowed aria-disabled:opacity-40"

interface TeamSelectorProps {
  /** Known people, in seat order. Seats beyond this list show as open, numbered slots. */
  members?: TeamMember[]
  /** Controlled seat count. Pair it with `onChange`. */
  value: number
  min?: number
  max?: number
  onChange: (size: number) => void
  label?: string
  /** Word under the number: [one, many]. */
  unit?: [string, string]
  className?: string
}

export default function TeamSelector({
  members = [],
  value,
  min = 1,
  max = 12,
  onChange,
  label = "Team size",
  unit: [one, many] = ["member", "members"],
  className,
}: TeamSelectorProps) {
  const labelId = useId()
  const upperBound = Math.max(min, max)
  const clampCount = (count: number) => Math.min(Math.max(count, min), upperBound)
  const count = clampCount(value)
  const [direction, setDirection] = useState<1 | -1>(1)
  // Direction follows every change (state adjusted during render, as React recommends).
  const [previousCount, setPreviousCount] = useState(count)
  if (count !== previousCount) {
    setPreviousCount(count)
    setDirection(count > previousCount ? 1 : -1)
  }

  const [isVibrating, setIsVibrating] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const vibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrubRef = useRef<{ id: number; startX: number; startCount: number } | null>(null)
  const stretchX = useMotionValue(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(
    () => () => {
      if (vibrationTimeoutRef.current) clearTimeout(vibrationTimeoutRef.current)
    },
    []
  )

  const triggerVibration = () => {
    if (prefersReducedMotion || vibrationTimeoutRef.current) return
    setIsVibrating(true)
    vibrationTimeoutRef.current = setTimeout(() => {
      setIsVibrating(false)
      vibrationTimeoutRef.current = null
    }, SHAKE_DURATION_MS)
  }

  const changeCount = (next: number) => {
    const clamped = clampCount(next)
    if (clamped !== count) onChange(clamped)
  }

  /** Steps by `delta`, or shakes when the step would cross a bound. */
  const step = (delta: number) => {
    const next = count + delta
    if (next < min || next > upperBound) return triggerVibration()
    changeCount(next)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || scrubRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubRef.current = { id: event.pointerId, startX: event.clientX, startCount: count }
    setIsScrubbing(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scrub = scrubRef.current
    if (!scrub || scrub.id !== event.pointerId) return
    const raw = scrub.startCount + (event.clientX - scrub.startX) / SCRUB_STEP_PX
    changeCount(Math.round(raw))
    // Past a bound the number keeps following the pointer with growing resistance, never more than RUBBER_BAND_PX.
    let overshoot = 0
    if (raw < min) overshoot = (raw - min) * SCRUB_STEP_PX
    else if (raw > upperBound) overshoot = (raw - upperBound) * SCRUB_STEP_PX
    stretchX.set(Math.sign(overshoot) * RUBBER_BAND_PX * (1 - Math.exp(-Math.abs(overshoot) / (RUBBER_BAND_PX * 4))))
  }

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubRef.current?.id !== event.pointerId) return
    scrubRef.current = null
    setIsScrubbing(false)
    if (prefersReducedMotion) stretchX.set(0)
    else animate(stretchX, 0, SNAP_BACK)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowUp: () => step(1),
      ArrowRight: () => step(1),
      ArrowDown: () => step(-1),
      ArrowLeft: () => step(-1),
      Home: () => changeCount(min),
      End: () => changeCount(upperBound),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
  }

  const rollOffset = direction * (prefersReducedMotion ? 0 : ROLL_DISTANCE)
  const unit = count === 1 ? one : many
  const seats: Seat[] = Array.from({ length: count }, (_, index) => {
    const member = members.at(index)
    return member?.name.trim() ? { ...member, isOpen: false } : { id: `open-seat-${index + 1}`, name: `Seat ${index + 1}`, isOpen: true }
  })
  const overflowCount = count > VISIBLE_AVATARS ? count - (VISIBLE_AVATARS - 1) : 0
  const visibleSeats = overflowCount ? seats.slice(0, VISIBLE_AVATARS - 1) : seats

  return (
    <div className={cn("bg-card w-full max-w-xs rounded-2xl border p-5", className)}>
      <span className="text-muted-foreground block text-[13px] font-medium" id={labelId}>
        {label}
      </span>

      <MotionConfig reducedMotion="user">
        {/* Decorative: the spinbutton below carries the value. */}
        <div aria-hidden="true" className="mt-4 mb-6 flex h-10 items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            {visibleSeats.map((seat, index) => (
              <motion.div
                animate="visible"
                exit="hidden"
                initial="hidden"
                key={seat.isOpen ? seat.id : `${index}-${seat.name}`}
                layout="position"
                style={{ marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP, zIndex: VISIBLE_AVATARS - index }}
                title={seat.name}
                transition={{ layout: { duration: 0.2, ease: EASE_OUT } }}
                variants={animations.avatar}
              >
                <SeatAvatar index={index} seat={seat} />
              </motion.div>
            ))}
            {overflowCount > 0 && (
              <motion.div
                animate="visible"
                className="bg-muted text-muted-foreground ring-card flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-[12px] font-medium ring-2"
                exit="hidden"
                initial="hidden"
                key="overflow"
                layout="position"
                style={{ marginLeft: -AVATAR_OVERLAP, zIndex: 0 }}
                transition={{ layout: { duration: 0.2, ease: EASE_OUT } }}
                variants={animations.avatar}
              >
                +<RollingText offset={rollOffset} text={String(overflowCount)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div animate={isVibrating ? "shake" : "idle"} className="flex items-center justify-center gap-4" initial="idle" variants={animations.vibration}>
          {/* aria-disabled rather than disabled: focus stays on the button at the bound and the click still shakes. */}
          <button aria-disabled={count <= min} aria-label={`Remove a ${one}`} className={STEPPER} onClick={() => step(-1)} type="button">
            <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          </button>

          {/* Scrub: drag sideways on the number, like a design tool's number field. */}
          <motion.div
            aria-labelledby={labelId}
            aria-valuemax={upperBound}
            aria-valuemin={min}
            aria-valuenow={count}
            aria-valuetext={`${count} ${unit}`}
            className={cn(
              "hover:bg-muted/60 focus-visible:ring-ring/50 flex min-w-20 touch-pan-y flex-col items-center rounded-xl px-2 py-1 outline-hidden transition-colors duration-150 select-none focus-visible:ring-2 [@media(pointer:fine)]:cursor-ew-resize",
              isScrubbing && "bg-muted"
            )}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={endScrub}
            onPointerCancel={endScrub}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endScrub}
            role="spinbutton"
            style={{ x: stretchX }}
            tabIndex={0}
          >
            <RollingText className="text-foreground h-9 text-3xl leading-9 font-semibold" offset={rollOffset} text={String(count)} />
            <span className="text-muted-foreground text-[11px]">{unit}</span>
          </motion.div>

          <button aria-disabled={count >= upperBound} aria-label={`Add a ${one}`} className={STEPPER} onClick={() => step(1)} type="button">
            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          </button>
        </motion.div>
      </MotionConfig>

      {/* Announces changes made with the buttons or the drag; the spinbutton itself only speaks while focused. */}
      <output aria-live="polite" className="sr-only">
        {count} {unit}
      </output>
    </div>
  )
}
