'use client'
import { useEffect, useMemo, useRef } from 'react'
import { IS_PRODUCTION } from '@/lib/env'
import { GATE } from '@/motion/timing/global'
import { S03 } from '@/motion/timing/s03'
import { drivePlay, driveScroll } from '@/motion/scroll-driver'
import { gate } from '@/motion/visibility'
import { SERVICE_3D_QUERY } from '@/stage/host'
import type { StageEvent } from '@/stage/types'
import type { FigureConfig } from '../types'
import { useFigure } from '../use-figure.client'

/**
 * The S-03 controller. Picks the mode once per page view:
 *   scrub   ≥ 1024 px with a fine pointer and the sheet's [data-scrub-track]: --p follows the
 *           scroll and the Stage may hand off to WebGL at p = .38 (front elevation);
 *   play    otherwise: the 2D phases play on entry (Replay), then the batch;
 *   pinned  /kit/fig/s03?p=… outside production: --p is pinned (seam and frame captures).
 * The batch (svg tier) runs document by document and stops at HELD FOR APPROVAL. Nothing
 * approves by itself. The approved state lives on the figure (data-rev="approved"), never
 * in the scene, so a hand-back or a fallback keeps it.
 */

type Step = 'feed' | 'read' | 'out' | 'gate' | 'drop'
interface Leg {
  doc: number
  step: Step
  ms: number
}

/** Two documents read within tolerance, the third goes to a person (views/s03 S03_BATCH). */
const LEGS: readonly Leg[] = [0, 1, 2].flatMap((doc): Leg[] => [
  { doc, step: 'feed', ms: S03.feedMs },
  { doc, step: 'read', ms: S03.readMs },
  ...(doc < 2
    ? [{ doc, step: 'out' as const, ms: S03.outMs }]
    : [
        { doc, step: 'gate' as const, ms: S03.gateMs },
        { doc, step: 'drop' as const, ms: S03.dropMs },
      ]),
])

type Mode = 'scrub' | 'play' | 'pinned'

function pickMode(): { mode: Mode; p: number | null; track: HTMLElement | null } {
  if (typeof window === 'undefined') return { mode: 'play', p: null, track: null }
  const q = IS_PRODUCTION ? null : new URLSearchParams(location.search).get('p')
  const p = q === null || q === '' ? NaN : Number(q)
  if (Number.isFinite(p)) return { mode: 'pinned', p: Math.min(1, Math.max(0, p)), track: null }
  const track =
    document
      .getElementById('fig-s03')
      ?.closest('section')
      ?.querySelector<HTMLElement>('[data-scrub-track]') ?? null
  const scrub = !!track && matchMedia(SERVICE_3D_QUERY).matches
  return { mode: scrub ? 'scrub' : 'play', p: null, track: scrub ? track : null }
}

export function S03Controller({
  liveHeld,
  liveApproved,
}: {
  liveHeld: string
  liveApproved: string
}) {
  const pick = useMemo(pickMode, [])
  const config = useMemo<FigureConfig>(
    () =>
      pick.mode === 'play'
        ? { driver: 'time' }
        : { driver: 'scroll', stage: { scene: 's03', load: 'near', mode: 'scrub' } },
    [pick],
  )
  const onEvent = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('s03', config, (e) => onEvent.current(e))

  useEffect(() => {
    const root = api.root
    if (!root) return
    const btn = root.querySelector<HTMLButtonElement>('button[data-action="approve"]')
    const offs: (() => void)[] = []
    let p = pick.p ?? 0
    let started = false
    let stopRun: (() => void) | null = null
    let stopPlay: (() => void) | null = null
    root.dataset.mode = pick.mode

    const isStill = () => root.dataset.phase === 'still' && !('userPlay' in root.dataset)
    const webgl = () => root.dataset.medium === 'webgl'
    const enable = (on: boolean) => {
      if (!btn) return
      btn.setAttribute('aria-disabled', on ? 'false' : 'true')
      if (on) btn.removeAttribute('aria-describedby')
      else btn.setAttribute('aria-describedby', 'fig-s03-wait')
    }
    const clearSteps = () => {
      delete root.dataset.doc
      delete root.dataset.step
    }

    /** At HELD FOR APPROVAL. `say` announces it (a batch that just arrived there). */
    const held = (say: boolean) => {
      stopRun?.()
      stopRun = null
      clearSteps()
      root.dataset.cards = '2'
      const was = root.dataset.batch
      root.dataset.batch = 'held'
      enable(true)
      if (say && was !== 'held') api.announce(liveHeld)
    }

    /** The svg batch, leg by leg; time runs only while motion runs and the figure is on screen. */
    const runSvg = () => {
      stopRun?.()
      started = true
      root.dataset.batch = 'run'
      root.dataset.cards = '0'
      enable(false)
      let elapsed = 0
      let prev = 0
      let at = -1
      let raf = 0
      const running = () =>
        (document.documentElement.dataset.motion !== 'paused' || 'userPlay' in root.dataset) &&
        !('offscreen' in root.dataset)
      const frame = (t: number) => {
        if (prev && running()) elapsed += t - prev
        prev = t
        let sum = 0
        let k = 0
        while (k < LEGS.length && elapsed >= sum + LEGS[k]!.ms) sum += LEGS[k++]!.ms
        if (k >= LEGS.length) return held(true)
        if (k !== at) {
          at = k
          const leg = LEGS[k]!
          root.dataset.doc = String(leg.doc)
          root.dataset.step = leg.step
          if (leg.step === 'out') root.dataset.cards = String(leg.doc + 1)
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
      stopRun = () => cancelAnimationFrame(raf)
    }

    /** The batch starts once, at motionFromP, in whichever medium is live. */
    const maybeStart = () => {
      if (started || p < S03.motionFromP || webgl() || isStill()) return
      runSvg()
    }

    const progress = (v: number) => {
      p = v
      api.handle?.setProgress(v)
      maybeStart()
    }

    const play = () => {
      stopPlay?.()
      stopRun?.()
      started = false
      delete root.dataset.batch
      delete root.dataset.rev
      root.dataset.cards = '0'
      clearSteps()
      enable(false)
      stopPlay = drivePlay({
        target: root,
        durationMs: S03.playMs,
        onProgress: (raw) => root.style.setProperty('--p', (raw * S03.handoffP).toFixed(4)),
        onDone: () => {
          p = 1
          root.style.setProperty('--p', '1')
          maybeStart()
        },
      })
    }

    /** The scene is running (or ran) this batch, so the SVG runner is not. */
    let sceneBatch = false
    onEvent.current = (e) => {
      if (e.type === 'handoff') {
        if (stopRun) {
          // the svg runner had started: the scene takes the batch over from its start
          stopRun()
          stopRun = null
          sceneBatch = true
        }
        if (root.dataset.rev === 'approved') api.command('approve', 'instant')
      } else if (e.type === 'beat') {
        if (e.beat === 'running') {
          started = true
          sceneBatch = true
          root.dataset.batch = 'run'
          enable(false)
        } else if (e.beat === 'held') held(true)
      } else if (e.type === 'fallback' || e.type === 'handback') {
        // Back on SVG: a batch the scene was running shows where it stands (HELD at least).
        if (sceneBatch) {
          sceneBatch = false
          if (root.dataset.batch) held(false)
        } else maybeStart()
      }
    }

    const approve = () => {
      if (!btn || btn.getAttribute('aria-disabled') === 'true') return
      if (root.dataset.rev !== 'approved') {
        root.dataset.rev = 'approved'
        api.announce(liveApproved)
        api.command('approve')
        return
      }
      // Run another batch (demo)
      delete root.dataset.rev
      if (isStill()) return
      if (webgl()) {
        root.dataset.batch = 'run'
        root.dataset.cards = '0'
        enable(false)
        api.command('runAnother')
      } else runSvg()
    }
    btn?.addEventListener('click', approve)
    offs.push(() => btn?.removeEventListener('click', approve))

    const replay = () => {
      api.play()
      play()
    }
    const replays = root.querySelectorAll<HTMLButtonElement>(
      'button[data-action="replay"], button[data-action="play"]',
    )
    for (const b of replays) b.addEventListener('click', replay)
    offs.push(() => replays.forEach((b) => b.removeEventListener('click', replay)))

    // ?state=approved on the /kit/fig harness (KitState) writes data-rev directly.
    const mo = new MutationObserver(() => {
      if (root.dataset.rev === 'approved' && root.dataset.batch !== 'held') held(false)
    })
    mo.observe(root, { attributes: true, attributeFilter: ['data-rev'] })
    offs.push(() => mo.disconnect())

    // With a Stage, nudge the figure (paint only) so the art box sits on whole device pixels:
    // the canvas is drawn on the pixel grid, so the SVG under it must be too, or the hand-off
    // shows a sub-pixel jump.
    if (pick.mode !== 'play') {
      const box = root.querySelector<HTMLElement>('.box')
      const snap = () => {
        if (!box) return
        root.style.translate = ''
        const r = box.getBoundingClientRect()
        const d = window.devicePixelRatio || 1
        const fx = Math.round(r.left * d) / d - r.left
        const fy = Math.round(r.top * d) / d - r.top
        if (Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01)
          root.style.translate = `${fx.toFixed(3)}px ${fy.toFixed(3)}px`
      }
      snap()
      const ro = new ResizeObserver(snap)
      ro.observe(document.documentElement)
      ro.observe(root)
      offs.push(() => ro.disconnect())
    }

    if (isStill()) held(false)
    else if (pick.mode === 'pinned') {
      root.style.setProperty('--p', String(p))
      progress(p)
      const onP = (e: Event) => {
        const v = Number((e as CustomEvent<number>).detail)
        if (!Number.isFinite(v)) return
        root.style.setProperty('--p', v.toFixed(4))
        progress(v)
      }
      root.addEventListener('ae:s03-p', onP)
      offs.push(() => root.removeEventListener('ae:s03-p', onP))
    } else if (pick.mode === 'scrub' && pick.track) {
      offs.push(driveScroll({ track: pick.track, target: root, onProgress: progress }))
    } else {
      offs.push(gate(root, GATE.entry, play))
    }
    if (root.dataset.rev === 'approved') held(false)

    return () => {
      offs.forEach((off) => off())
      stopRun?.()
      stopPlay?.()
      onEvent.current = () => {}
    }
  }, [api, pick, liveHeld, liveApproved])

  return null
}
