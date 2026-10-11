'use client'
import { useSyncExternalStore } from 'react'
import type { Tier } from '@/stage/types'
import { STATE_EVENT } from './head-script'

/**
 * React's read-only view of the page state the head script writes on <html>.
 * React never writes it: the switch and the Stage go through window.__ae and
 * src/stage/tier.ts.
 */

export interface MotionSnapshot {
  readonly js: boolean
  readonly reduced: boolean
  readonly paused: boolean
  readonly tier: Tier
  readonly forced: Tier | null
  readonly tierMax: 'svg' | 'webgl'
}

const SERVER: MotionSnapshot = {
  js: false,
  reduced: false,
  paused: false,
  tier: 'svg',
  forced: null,
  tierMax: 'webgl',
}
let last: MotionSnapshot = SERVER
let key = ''

export function getMotionSnapshot(): MotionSnapshot {
  const d = document.documentElement.dataset
  const k = `${d.js}|${d.rm}|${d.motion}|${d.tier}|${d.tierForce}|${d.tierMax}`
  if (k !== key) {
    key = k
    last = {
      js: d.js === '1',
      reduced: d.rm === '1',
      paused: d.motion === 'paused',
      tier: (d.tier as Tier | undefined) ?? 'svg',
      forced: (d.tierForce as Tier | undefined) ?? null,
      tierMax: d.tierMax === 'svg' ? 'svg' : 'webgl',
    }
  }
  return last
}

export function subscribeMotion(cb: () => void): () => void {
  document.addEventListener(STATE_EVENT, cb)
  return () => document.removeEventListener(STATE_EVENT, cb)
}

/** The current page state; the server snapshot is svg, running, no JS. */
export const useMotion = (): MotionSnapshot =>
  useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => SERVER)
