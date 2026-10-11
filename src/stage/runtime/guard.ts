import { GUARD } from '@/motion/timing/global'

export type GuardVerdict = 'none' | 'dpr1' | 'fallback'

/**
 * Frame guard (D9): skip GUARD.skip frames, then take the median of the next
 * GUARD.samples continuous animated frames (frames 6 to 65). Over
 * GUARD.medianMs: first drop the DPR to 1, then fall back to SVG for the
 * session. A median under the limit settles it for good.
 */
export class FrameGuard {
  private s: number[] = []
  private skip: number = GUARD.skip
  private step: 0 | 1 | 2 = 0
  /** Medians seen so far, for the debug state. */
  readonly medians: number[] = []

  get settled() {
    return this.step === 2
  }

  get tripped() {
    return this.step > 0 && this.medians.some((m) => m > GUARD.medianMs)
  }

  reset() {
    this.s.length = 0
    this.skip = GUARD.skip
  }

  sample(dt: number): GuardVerdict {
    if (this.step === 2) return 'none'
    if (this.skip > 0) {
      this.skip--
      return 'none'
    }
    this.s.push(dt)
    if (this.s.length < GUARD.samples) return 'none'
    const sorted = [...this.s].sort((a, b) => a - b)
    const m = (sorted[(GUARD.samples >> 1) - 1]! + sorted[GUARD.samples >> 1]!) / 2
    this.medians.push(m)
    this.s.length = 0
    if (m <= GUARD.medianMs) {
      this.step = 2
      return 'none'
    }
    if (this.step === 0) {
      this.step = 1
      this.skip = GUARD.skip
      return 'dpr1'
    }
    this.step = 2
    return 'fallback'
  }
}
