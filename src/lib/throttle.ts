// ponytail: global fixed-window counter, one per use. In-process, so it holds per serverless instance;
// move to a shared store (Postgres/Redis) if abuse ever gets past it. Global, not per-IP: x-forwarded-for
// is client-spoofable on this deploy, so a per-IP cap would be bypassed by rotating the header.
export function fixedWindow(max: number, windowMs = 60_000) {
  let start = 0
  let count = 0
  return {
    /** Counts an attempt; false once the window's budget is spent. */
    take(): boolean {
      const now = Date.now()
      if (now - start > windowMs) {
        start = now
        count = 0
      }
      return ++count <= max
    },
    reset() {
      count = 0
    },
  }
}
