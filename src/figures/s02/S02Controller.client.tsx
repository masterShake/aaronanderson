'use client'
import { useEffect, useRef, useState } from 'react'
import type { Pt } from '@/drawings/types'
import {
  S02_DESTS,
  S02_ROUTES,
  s02Mech,
  type S02Lens,
  type S02MechState,
} from '@/drawings/views/s02'
import { GATE } from '@/motion/timing/global'
import { S02 } from '@/motion/timing/s02'
import { drivePlay, driveScroll } from '@/motion/scroll-driver'
import { gate } from '@/motion/visibility'
import { SERVICE_3D_QUERY } from '@/stage/host'
import type { StageEvent } from '@/stage/types'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'

/**
 * The S-02 controller. Desktop (≥ 1024 px, fine pointer) with the sheet's scrub track:
 * --p follows the text column; the Stage hands off at S02.handoffP and runs the loops in
 * WebGL. Everywhere else (and whenever the medium is SVG): the 2D phases run on --p, and
 * from S02.motionFromP the plan mechanism moves the packets for S02.loops loops, then the
 * figure idles on the iso print with Run again. Without a track (the /kit/fig harness) a
 * preview ?p= pins the progress; otherwise the figure plays on entry.
 */

export interface S02Geo {
  vb: readonly [number, number]
  lens: S02Lens
  stallBack: number
  /** The lead's straight run, CRM port to junction. */
  lead: readonly [Pt, Pt]
  /** The carrier's walk (units). */
  walk: number
}

const NOT_PROD = process.env.SITE_ENV !== 'production'
/** A packet's length on its route (units). */
const PK = 14

function pinnedP(): number | null {
  if (!NOT_PROD) return null
  const v = new URLSearchParams(location.search).get('p')
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null
}

const desktop = () => typeof matchMedia === 'function' && matchMedia(SERVICE_3D_QUERY).matches
const trackOf = (root: HTMLElement | null) =>
  root?.closest('section')?.querySelector<HTMLElement>('[data-scrub-track]') ?? null

export function S02Controller({
  geo,
  live,
}: {
  geo: { wide: S02Geo; tall: S02Geo }
  live: { done: string; failed: string }
}) {
  const [config] = useState<FigureConfig>(() => {
    const scrub =
      typeof window !== 'undefined' &&
      desktop() &&
      (Boolean(trackOf(document.getElementById('fig-s02'))) || pinnedP() !== null)
    return {
      driver: 'scroll',
      stage: { scene: 's02', load: 'near', mode: scrub ? 'scrub' : 'timeline' },
    }
  })
  const events = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('s02', config, (e) => events.current(e))

  useEffect(() => {
    const root = document.getElementById('fig-s02')
    if (!root) return
    const scrub = config.stage?.mode === 'scrub'
    const track = scrub ? trackOf(root) : null
    const pinned = pinnedP()
    const g = () => (root.dataset.family === 'tall' ? geo.tall : geo.wide)
    const offs: (() => void)[] = []
    let p = 0
    let medium: 'svg' | 'webgl' = 'svg'
    let t = 0
    let running = false
    let done = false
    let raf = 0
    let last = 0
    let beat = ''
    let pk: Partial<Record<string, SVGPathElement>> = {}
    let tag: HTMLElement | null = null

    const cache = () => {
      pk = {}
      for (const r of S02_ROUTES)
        pk[`pk.${r}`] =
          root.querySelector<SVGPathElement>(`svg.l-pkt [data-part="pk.${r}"]`) ?? undefined
      for (const d of S02_DESTS)
        pk[`lamp.${d}`] =
          root.querySelector<SVGPathElement>(`svg.l-pkt [data-part="lamp.${d}"]`) ?? undefined
      tag = root.querySelector<HTMLElement>('.labels [data-anchor="lead"]')
      root.style.setProperty('--s02-walk', String(g().walk))
    }
    cache()
    const mo = new MutationObserver(cache)
    mo.observe(root, { attributes: true, attributeFilter: ['data-family', 'data-layers'] })
    offs.push(() => mo.disconnect())

    const flag = (name: string, on: boolean) => {
      if (on) root.setAttribute(name, '')
      else root.removeAttribute(name)
    }

    const apply = (st: S02MechState | null) => {
      const geo1 = g()
      for (const r of S02_ROUTES) {
        const el = pk[`pk.${r}`]
        if (!el) continue
        const s = !st ? -1 : r === 'lead' ? st.lead : st.copy[r]
        el.style.opacity = s < 0 ? '0' : '1'
        if (s >= 0) el.style.strokeDashoffset = String(-(s - PK / 2) / geo1.lens[r])
      }
      for (const d of S02_DESTS) {
        const el = pk[`lamp.${d}`]
        if (el) el.style.opacity = st?.lamp[d] ? '1' : '0'
      }
      flag('data-lead', !!st && st.lead >= 0)
      flag('data-sync', !!st?.failed)
      flag('data-flash', !!st?.flash)
      if (st && st.lead >= 0 && tag) {
        const [a, b] = geo1.lead
        const k = st.lead / Math.max(1, geo1.lens.lead)
        const x = ((a[0] + (b[0] - a[0]) * k) / geo1.vb[0]) * 100
        const y = ((a[1] + (b[1] - a[1]) * k) / geo1.vb[1]) * 100
        const tall = geo1 === geo.tall
        tag.style.setProperty(tall ? '--lxt' : '--lx', x.toFixed(2))
        tag.style.setProperty(tall ? '--lyt' : '--ly', y.toFixed(2))
      }
    }

    const paused = () =>
      (document.documentElement.dataset.motion === 'paused' && !('userPlay' in root.dataset)) ||
      'offscreen' in root.dataset

    const frame = (now: number) => {
      raf = 0
      if (!running) return
      const dt = last ? Math.min(now - last, 50) : 0
      last = now
      if (!paused()) t += dt
      const geo1 = g()
      const st = s02Mech(t, geo1.lens, geo1.stallBack)
      apply(st)
      if (!st.done) root.dataset.loop = String(st.loop + 1)
      if (st.beat !== beat) {
        beat = st.beat
        if (beat === 'syncfail') api.announce(live.failed)
      }
      if (st.done) return finish()
      raf = requestAnimationFrame(frame)
    }

    const stopLoops = () => {
      cancelAnimationFrame(raf)
      raf = 0
      running = false
      beat = ''
      apply(null)
      delete root.dataset.loop
    }
    const finish = () => {
      stopLoops()
      done = true
      root.dataset.print = ''
      api.done()
      api.announce(live.done)
    }
    const startLoops = (from = 0) => {
      if (medium === 'webgl') return
      stopLoops()
      done = false
      delete root.dataset.print
      t = from
      last = 0
      running = true
      root.dataset.loop = ''
      root.dataset.phase = 'playing'
      raf = requestAnimationFrame(frame)
    }
    const resetAll = () => {
      stopLoops()
      done = false
      delete root.dataset.print
    }

    const onProgress = (v: number) => {
      p = v
      api.setProgress(v)
      if (p < S02.handoffP) {
        if (running || done) resetAll()
      } else if (p >= S02.motionFromP && !running && !done && medium === 'svg' && pinned === null)
        startLoops(0)
    }

    let stopPlay: (() => void) | null = null
    const playFromStart = () => {
      stopPlay?.()
      resetAll()
      onProgress(0)
      stopPlay = drivePlay({
        target: root,
        durationMs: S02.playMs,
        onProgress: (q) => onProgress(q * S02.handoffP),
        onDone: () => {
          const id = setTimeout(() => startLoops(0), S02.holdMs)
          stopPlay = () => clearTimeout(id)
        },
      })
    }
    offs.push(() => stopPlay?.())

    if (track) offs.push(driveScroll({ track, target: root, onProgress }))
    else if (pinned !== null) onProgress(pinned)
    else if (document.documentElement.dataset.tier !== 'still')
      offs.push(gate(root, GATE.entry, playFromStart))
    if (NOT_PROD && pinned !== null) {
      // Preview only: the gate tests scrub the pinned harness with `ae:progress` events.
      const onP = (e: Event) => onProgress(Number((e as CustomEvent<number>).detail))
      root.addEventListener('ae:progress', onP)
      offs.push(() => root.removeEventListener('ae:progress', onP))
    }

    events.current = (e) => {
      if (e.type === 'handoff') {
        medium = 'webgl'
        resetAll()
      } else if (e.type === 'handback' || e.type === 'fallback') {
        const was = medium
        medium = 'svg'
        flag('data-sync', false)
        if (was === 'webgl' && p >= S02.motionFromP && !done && pinned === null) startLoops(0)
      } else if (e.type === 'beat') {
        if (e.beat === 'syncfail') {
          flag('data-sync', true)
          api.announce(live.failed)
        } else if (e.beat === 'synced') flag('data-sync', false)
        else if (e.beat === 'idle') {
          done = true
          api.done()
          api.announce(live.done)
        }
      }
    }

    const onClick = (ev: MouseEvent) => {
      const btn = (ev.target as Element | null)?.closest<HTMLElement>('[data-action]')
      if (!btn || !root.contains(btn)) return
      const action = btn.dataset.action
      if (action !== 'replay' && action !== 'play' && action !== 'run-again') return
      api.play()
      if (medium === 'webgl') return
      if (action === 'run-again' || track || pinned !== null) startLoops(0)
      else playFromStart()
    }
    root.addEventListener('click', onClick)
    offs.push(() => root.removeEventListener('click', onClick))

    return () => {
      events.current = () => {}
      stopLoops()
      offs.forEach((off) => off())
    }
  }, [api, config, geo, live])

  return null
}
