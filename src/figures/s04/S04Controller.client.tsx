'use client'
import { useEffect, useRef, useState } from 'react'
import { S04_DIALS, S04_QUESTIONS, s04Mech, type S04Question } from '@/drawings/views/s04'
import { GATE } from '@/motion/timing/global'
import { S04 } from '@/motion/timing/s04'
import { drivePlay, driveScroll } from '@/motion/scroll-driver'
import { gate } from '@/motion/visibility'
import { SERVICE_3D_QUERY } from '@/stage/host'
import type { StageEvent } from '@/stage/types'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'
import { snapToPixels } from '../s02/pixel-snap.client'

/**
 * The S-04 controller. With the sheet's scrub track (≥ 1024 px, fine pointer) --p
 * follows the text column; otherwise a preview ?p= pins it, or the figure plays its 2D
 * phases on entry. From S04.motionFromP the loops run three times: packets rise up the
 * risers, the needles settle into IN RANGE, the owner's report slides out; then the
 * figure idles with Run again. The question chips move one needle each and reveal their
 * SAMPLE answer in the polite live region at once.
 */

export interface S04Geo {
  /** Each tile's start offset (units) and tilt (degrees). */
  tiles: readonly { part: string; dx: number; dy: number; rot: number }[]
  /** Riser length (units). */
  riser: number
}

const NOT_PROD = process.env.SITE_ENV !== 'production'
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

export function S04Controller({
  geo,
  done: doneText,
}: {
  geo: { wide: S04Geo; tall: S04Geo }
  done: string
}) {
  const [config] = useState<FigureConfig>(() => {
    const scrub =
      typeof window !== 'undefined' &&
      desktop() &&
      (Boolean(trackOf(document.getElementById('fig-s04'))) || pinnedP() !== null)
    return {
      driver: 'scroll',
      stage: { scene: 's04', load: 'near', mode: scrub ? 'scrub' : 'timeline' },
    }
  })
  const events = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('s04', config, (e) => events.current(e))

  useEffect(() => {
    const root = document.getElementById('fig-s04')
    if (!root) return
    const scrub = config.stage?.mode === 'scrub'
    const track = scrub ? trackOf(root) : null
    const pinned = pinnedP()
    const g = () => (root.dataset.family === 'tall' ? geo.tall : geo.wide)
    const offs: (() => void)[] = [snapToPixels(root)]
    const chosen = new Set<string>()
    const asked = new Map<string, S04Question>()
    let medium: 'svg' | 'webgl' = 'svg'
    let settleTimer: ReturnType<typeof setTimeout> | 0 = 0
    let p = 0
    let t = 0
    let running = false
    let done = false
    let raf = 0
    let last = 0
    let pk: (SVGPathElement | null)[] = []

    const cache = () => {
      for (const tile of g().tiles) {
        const el = root.querySelector<SVGGElement>(`svg.l-ghost [data-part="${tile.part}"]`)
        el?.style.setProperty('--dx', String(tile.dx))
        el?.style.setProperty('--dy', String(tile.dy))
        el?.style.setProperty('--rot', String(tile.rot))
      }
      pk = [0, 1, 2].map((i) =>
        root.querySelector<SVGPathElement>(`svg.l-pkt [data-part="pk.${i}"]`),
      )
    }
    cache()
    root.style.setProperty('--s04-card', '0')
    const mo = new MutationObserver(cache)
    mo.observe(root, { attributes: true, attributeFilter: ['data-family', 'data-layers'] })
    offs.push(() => mo.disconnect())

    const setReading = (dial: string, r: string | null) => {
      if (r) root.setAttribute(`data-${dial}`, r)
      else root.removeAttribute(`data-${dial}`)
    }
    const settle = (on: boolean) => {
      for (const d of S04_DIALS) if (!chosen.has(d)) setReading(d, on ? 'in' : null)
    }
    const apply = (rise: readonly number[] | null, card: number) => {
      const len = g().riser
      pk.forEach((el, i) => {
        if (!el) return
        const s = rise?.[i] ?? -1
        el.style.opacity = s < 0 ? '0' : '1'
        if (s >= 0) el.style.strokeDashoffset = String(-(s - PK / 2) / len)
      })
      root.style.setProperty('--s04-card', card.toFixed(3))
      if (card > 0.4) root.dataset.card = ''
      else delete root.dataset.card
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
      const st = s04Mech(t, g().riser, S04)
      apply(st.rise, st.card)
      if (st.settled) settle(true)
      if (st.done) return finish()
      root.dataset.loop = String(st.loop + 1)
      raf = requestAnimationFrame(frame)
    }
    const stopLoops = () => {
      cancelAnimationFrame(raf)
      raf = 0
      running = false
      delete root.dataset.loop
    }
    const finish = () => {
      stopLoops()
      apply(null, 1)
      done = true
      api.done()
      if (doneText) api.announce(doneText)
    }
    const startLoops = () => {
      if (medium === 'webgl') return
      stopLoops()
      done = false
      t = 0
      last = 0
      running = true
      apply(null, 0)
      root.dataset.phase = 'playing'
      raf = requestAnimationFrame(frame)
    }
    const resetAll = () => {
      stopLoops()
      done = false
      apply(null, 0)
      settle(false)
    }
    const onProgress = (v: number) => {
      p = v
      api.setProgress(v)
      if (p < S04.handoffP) {
        if (running || done) resetAll()
      } else if (p >= S04.motionFromP && !running && !done && pinned === null) startLoops()
    }

    let stopPlay: (() => void) | null = null
    const playFromStart = () => {
      stopPlay?.()
      resetAll()
      onProgress(0)
      stopPlay = drivePlay({
        target: root,
        durationMs: S04.playMs,
        onProgress: (q) => onProgress(q * S04.handoffP),
        onDone: () => {
          const id = setTimeout(startLoops, S04.holdMs)
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
      if (e.type === 'ready') for (const q of asked.values()) api.command('ask', q)
      else if (e.type === 'handoff') {
        medium = 'webgl'
        resetAll()
      } else if (e.type === 'handback' || e.type === 'fallback') {
        const was = medium
        medium = 'svg'
        clearTimeout(settleTimer)
        if (was === 'webgl' && p >= S04.motionFromP && !done && pinned === null) startLoops()
      } else if (e.type === 'beat') {
        clearTimeout(settleTimer)
        if (e.beat === 'running') settleTimer = setTimeout(() => settle(true), S04.settleAt)
        else if (e.beat === 'built') settle(false)
        else if (e.beat === 'idle') {
          settle(true)
          done = true
          api.done()
          if (doneText) api.announce(doneText)
        }
      }
    }
    offs.push(() => clearTimeout(settleTimer))

    const ask = (q: S04Question) => {
      const { dial, reading } = S04_QUESTIONS[q]
      chosen.add(dial)
      asked.set(dial, q)
      api.command('ask', q)
      setReading(dial, reading)
      for (const b of root.querySelectorAll<HTMLElement>('[data-q]'))
        b.setAttribute('aria-pressed', String(b.dataset.q === q))
      for (const a of root.querySelectorAll<HTMLElement>('[data-a]'))
        if (a.dataset.a === q) a.dataset.on = ''
        else delete a.dataset.on
      root.dataset.asked = q
    }

    const onClick = (ev: MouseEvent) => {
      const el = ev.target as Element | null
      const q = el?.closest<HTMLElement>('[data-q]')
      if (q && root.contains(q)) return ask(q.dataset.q as S04Question)
      const btn = el?.closest<HTMLElement>('[data-action]')
      if (!btn || !root.contains(btn)) return
      const action = btn.dataset.action
      if (action !== 'replay' && action !== 'play' && action !== 'run-again') return
      api.play()
      if (medium === 'webgl') return
      if (action === 'run-again' || track || pinned !== null) startLoops()
      else playFromStart()
    }
    root.addEventListener('click', onClick)
    offs.push(() => root.removeEventListener('click', onClick))

    return () => {
      events.current = () => {}
      stopLoops()
      offs.forEach((off) => off())
    }
  }, [api, config, geo, doneText])

  return null
}
