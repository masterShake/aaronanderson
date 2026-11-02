'use client'

import { useEffect, useRef } from 'react'
import { hasQueryFlag, hasWebGL2, whenIdle } from '@/client/env'
import { startStory } from '@/client/story'
import styles from './StageMount.module.css'

export interface TitleStrip {
  project: string
  drawing: string
  scale: string
  date: string
  sheet: string
}

/**
 * The pinned stage behind the story: canvas, sheet frame, title strip and paper-space overlay.
 * It renders static markup only. On mount it starts the story store (scroll → story time) and,
 * at the first idle moment, lazy-loads the three.js scene. All runtime state lives in DOM
 * attributes (data-stage-state), never in React state.
 */
export function StageMount({ strip }: { strip: TitleStrip }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const root = el?.closest<HTMLElement>('[data-story]')
    if (!el || !root) return
    const story = startStory(root)
    let disposed = false
    let stage: { dispose(): void } | undefined
    const fail = () => {
      if (!disposed) el.dataset.stageState = 'fallback'
    }
    const cancel = whenIdle(
      () => {
        if (hasQueryFlag('nowebgl') || !hasWebGL2()) return fail()
        el.dataset.stageState = 'loading'
        import('@/scene/stage')
          .then(({ createStage }) => {
            if (!disposed) stage = createStage(el, { story, onFail: fail })
          })
          .catch(fail)
      },
      new URLSearchParams(location.search).has('p') ? 0 : 1000,
    )
    return () => {
      disposed = true
      cancel()
      stage?.dispose()
      story.dispose()
    }
  }, [])

  return (
    <div ref={ref} className={styles.stage} data-stage data-stage-state="idle" aria-hidden="true">
      <div className={styles.band} />
      <div className={styles.poster} />
      <div className={styles.canvasHost} data-canvas-host />
      <div className={styles.frame} />
      <dl className={styles.strip} data-strip>
        <div className={styles.project}>
          <dt>Project</dt>
          <dd>{strip.project}</dd>
        </div>
        <div className={styles.drawing}>
          <dt>Drawing</dt>
          <dd>{strip.drawing}</dd>
        </div>
        <div className={styles.scale}>
          <dt>Scale</dt>
          <dd>{strip.scale}</dd>
        </div>
        <div className={styles.drawn}>
          <dt>Drawn</dt>
          <dd className={styles.ai}>AI</dd>
        </div>
        <div className={styles.checked}>
          <dt>Checked</dt>
          <dd>
            <span className={styles.pending}>—</span>
            <span className={styles.signed}>You</span>
          </dd>
        </div>
        <div className={styles.date}>
          <dt>Date</dt>
          <dd>{strip.date}</dd>
        </div>
        <div className={styles.sheet}>
          <dt>Sheet</dt>
          <dd>{strip.sheet}</dd>
        </div>
      </dl>
      <div className={styles.overlay} data-overlay />
    </div>
  )
}
