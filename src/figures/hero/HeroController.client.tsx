'use client'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFigure } from '@/figures/use-figure.client'
import type { FigureConfig } from '@/figures/types'
import type { StageEvent } from '@/stage/types'
import { coarsePointer } from '@/stage/probe'
import { HERO } from '@/motion/timing/hero'
import { IS_PRODUCTION } from '@/lib/env'

/**
 * The hero's client half (stage-hero §3.5). The storyboard itself is CSS, timed from one start;
 * this only decides at the rest poses and wires the strip:
 * - data-family follows the box (tall under 520 px), set before the Stage registers (C3);
 * - at the decision (the hero-decision animation starting at HERO.decisionAt) it asks the Stage
 *   to hand off; on desktop, if 3D was late, it asks again at the loop boundary
 *   (HERO.lateHandoffAt). Phones never swap mid-sequence;
 * - Stage beats set data-rev for the chip; a fallback resumes the CSS mechanism at atMs;
 * - Play the drawing restarts the whole sequence, Run again only the mechanism;
 * - ?frame=plan (not in production) pins the SVG at the plan frame for the seam check.
 */

const CONFIG: FigureConfig = {
  driver: 'time',
  stage: { scene: 'hero', load: 'hero', mode: 'timeline' },
}
const FAMILY_MIN = 520

/** Every CSS animation in the figure, set to `ms` from the figure's start, and playing. */
function seek(root: HTMLElement, ms: number) {
  for (const a of root.getAnimations({ subtree: true })) {
    if (!(a instanceof CSSAnimation)) continue
    // play() first: on a finished animation it rewinds to 0
    a.play()
    a.currentTime = ms
  }
}

export function HeroController({ liveDone }: { liveDone: string }) {
  const handedAt = useRef<number | null>(null)
  const onStage = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('hero', CONFIG, (e: StageEvent) => onStage.current(e))

  // C3: the family before the Stage registers (useLayoutEffect runs before useFigure's effect).
  useLayoutEffect(() => {
    const root = document.getElementById('fig-hero')
    if (!root) return
    const set = () => {
      const fam = root.clientWidth < FAMILY_MIN ? 'tall' : 'wide'
      if (root.dataset.family !== fam) root.dataset.family = fam
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(root)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const root = document.getElementById('fig-hero')
    if (!root) return
    const frame = !IS_PRODUCTION && /[?&]frame=plan\b/.test(location.search)
    if (frame) {
      root.dataset.frame = 'plan'
      return
    }
    const phone = coarsePointer()
    const mark = (pose: 'decision' | 'boundary', loop?: number) => {
      if (api.markRest(pose, loop)) {
        handedAt.current = pose === 'decision' ? HERO.decisionAt : HERO.lateHandoffAt
        return true
      }
      return false
    }
    const onAnim = (e: AnimationEvent) => {
      // CSS Modules prefix keyframe names (hero-module__…__hero-decision)
      switch (/hero-(decision|boundary|idle)$/.exec(e.animationName)?.[0]) {
        case 'hero-decision':
          if (handedAt.current === null) mark('decision')
          break
        case 'hero-boundary':
          // desktop only: phones never swap mid-sequence
          if (handedAt.current === null && !phone) mark('boundary', 1)
          break
        case 'hero-idle':
          if (root.dataset.medium !== 'webgl') {
            root.dataset.rev = 'done'
            api.announce(liveDone)
          }
          break
      }
    }
    const clock = root.querySelector<HTMLElement>('[data-clock]')
    clock?.addEventListener('animationstart', onAnim)
    onStage.current = (e) => {
      if (e.type === 'handoff') root.dataset.rev = 'rewired'
      else if (e.type === 'beat') {
        if (e.beat === 'running') root.dataset.rev = 'running'
        if (e.beat === 'idle') {
          root.dataset.rev = 'done'
          api.announce(liveDone)
        }
      } else if (e.type === 'fallback') {
        const at = handedAt.current
        handedAt.current = null
        delete root.dataset.rev
        // resume the SVG mechanism where the 3D one stopped
        if (at !== null && e.atMs !== undefined)
          seek(root, Math.min(HERO.idleAt, at + Math.max(0, e.atMs - HERO.tiltDur)))
      } else if (e.type === 'handback') {
        handedAt.current = null
        delete root.dataset.rev
      }
    }
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-action]')
      if (!b || !root.contains(b)) return
      if (b.dataset.action === 'play') {
        handedAt.current = null
        api.play()
        requestAnimationFrame(() => seek(root, 0))
      } else if (b.dataset.action === 'again') {
        if (root.dataset.medium === 'webgl') {
          root.dataset.rev = 'running'
          api.command('runAgain')
        } else {
          delete root.dataset.rev
          root.dataset.userPlay = ''
          seek(root, HERO.decisionAt + 1)
        }
      }
    }
    root.addEventListener('click', onClick)
    return () => {
      clock?.removeEventListener('animationstart', onAnim)
      root.removeEventListener('click', onClick)
      onStage.current = () => {}
    }
  }, [api, liveDone])

  return null
}
