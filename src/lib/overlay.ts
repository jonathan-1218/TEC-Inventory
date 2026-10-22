"use client"

import { useSyncExternalStore } from "react"

// A tiny store for the full-screen "Signing you in…" / "Logging out…" screen. Any client code can show it;
// <TransitionOverlay/> (mounted once in the root layout) renders it and hides it when the page has changed.
type State = { message: string | null; startPath: string | null; token: number }
let state: State = { message: null, startPath: null, token: 0 }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Show the overlay. It hides itself when the route changes, or after `maxMs` (use a short value when the page
 * stays put, like logging out of the dashboard, and a long one as a safety net when navigation is expected).
 */
export function showOverlay(message: string, maxMs = 10_000) {
  clearTimeout(timer)
  state = { message, startPath: typeof window === "undefined" ? null : window.location.pathname, token: state.token + 1 }
  emit()
  timer = setTimeout(hideOverlay, maxMs)
}

export function hideOverlay() {
  clearTimeout(timer)
  if (state.message === null) return
  state = { ...state, message: null }
  emit()
}

export function useOverlay() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state
  )
}
