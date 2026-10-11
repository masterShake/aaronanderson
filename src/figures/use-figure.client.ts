'use client'
import { useEffect, useMemo, useRef } from 'react'
import type { FigureId } from '@/content/types'
import { GATE } from '@/motion/timing/global'
import { gate, watchOffscreen } from '@/motion/visibility'
import { driveScroll } from '@/motion/scroll-driver'
import { watchSteps } from '@/motion/steps'
import { registerScene, type AnySceneId } from '@/stage/host'
import type { FigureHandle, LayoutId, Mode, StageEvent } from '@/stage/types'
import type { FigureApi, FigureConfig } from './types'
import { figureDomId } from './types'

/**
 * The figure's client half. Sets data-phase, runs the entry gate, the
 * off-screen watch and the scroll or step driver, and (for figures with a
 * stage) registers with the Stage: --p is forwarded, data-medium follows the
 * hand-off and hand-back events, and the handle is released on unmount
 * (idempotent, so StrictMode's remount keeps the same scene).
 */

export interface StageBinding {
  scene: AnySceneId
  mode: Mode
  onEvent?: (e: StageEvent) => void
}

/**
 * Registers one figure root with the Stage. Shared by useFigure and the
 * preview-only /kit/stage demo. Returns the handle and an undo.
 */
export function bindStage(
  root: HTMLElement,
  b: StageBinding,
): { handle: FigureHandle; off: () => void } | null {
  const slot = root.querySelector<HTMLElement>('.slot[data-stage-slot]')
  const still = slot?.querySelector<HTMLCanvasElement>('canvas.still')
  if (!slot || !still) return null
  const layout = (): LayoutId => (root.dataset.family === 'tall' ? 'tall' : 'wide')
  const handle = registerScene({
    scene: b.scene,
    mode: b.mode,
    layout: layout(),
    root,
    slot,
    still,
    onEvent(e) {
      if (e.type === 'handoff') root.dataset.medium = 'webgl'
      else if (e.type === 'handback' || e.type === 'fallback') root.dataset.medium = 'svg'
      b.onEvent?.(e)
    },
  })
  let last = layout()
  const mo = new MutationObserver(() => {
    const l = layout()
    if (l !== last) handle.setLayout((last = l))
  })
  mo.observe(root, { attributes: true, attributeFilter: ['data-family'] })
  return {
    handle,
    off: () => {
      mo.disconnect()
      handle.release()
    },
  }
}

export function useFigure(id: FigureId, config: FigureConfig): FigureApi {
  const root = useRef<HTMLElement | null>(null)
  const handle = useRef<FigureHandle | null>(null)
  useEffect(() => {
    const el = document.getElementById(figureDomId(id))
    root.current = el
    if (!el) return
    const offs: (() => void)[] = []
    const still = document.documentElement.dataset.tier === 'still'
    if (still) el.dataset.phase = 'still'
    else {
      el.dataset.phase = 'waiting'
      el.dataset.armed = ''
      offs.push(
        gate(el, config.gateRatio ?? GATE.entry, () => {
          el.dataset.inview = ''
          el.dataset.phase = 'playing'
        }),
      )
    }
    offs.push(watchOffscreen(el))
    if (config.stage && !still) {
      const bound = bindStage(el, { scene: config.stage.scene, mode: config.stage.mode })
      if (bound) {
        handle.current = bound.handle
        offs.push(() => {
          bound.off()
          handle.current = null
        })
      }
    }
    const track = config.track?.()
    if (config.driver === 'scroll' && track)
      offs.push(
        driveScroll({ track, target: el, onProgress: (p) => handle.current?.setProgress(p) }),
      )
    const steps = config.steps?.()
    if (config.driver === 'steps' && steps?.length) offs.push(watchSteps({ figure: el, steps }))
    return () => offs.forEach((off) => off())
  }, [id, config])

  return useMemo<FigureApi>(() => {
    const el = () => root.current
    return {
      get root() {
        return el()
      },
      get phase() {
        return (el()?.dataset.phase as FigureApi['phase']) ?? 'waiting'
      },
      get medium() {
        return el()?.dataset.medium === 'webgl' ? 'webgl' : 'svg'
      },
      get handle() {
        return handle.current
      },
      play() {
        const f = el()
        if (!f) return
        f.dataset.userPlay = ''
        f.dataset.run = String(Number(f.dataset.run ?? '0') + 1)
        f.dataset.phase = 'playing'
        handle.current?.play()
      },
      setRev(rev) {
        const f = el()
        if (f) f.dataset.rev = rev
      },
      setToggle(value) {
        const f = el()
        if (f) f.dataset.toggle = value
      },
      setProgress(p) {
        el()?.style.setProperty('--p', p.toFixed(4))
        handle.current?.setProgress(p)
      },
      command(name, arg) {
        handle.current?.command(name, arg)
      },
      announce(text) {
        const live = el()?.querySelector<HTMLElement>('[data-live]')
        if (live) live.textContent = text
      },
      markRest: (pose, loop) => handle.current?.requestHandoff(pose, loop) ?? false,
      done() {
        const f = el()
        if (!f) return
        f.dataset.phase = 'done'
        delete f.dataset.userPlay
      },
    }
  }, [])
}
