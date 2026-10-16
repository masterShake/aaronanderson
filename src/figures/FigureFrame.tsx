import type { CSSProperties } from 'react'
import type { FigureId } from '@/content/types'
import { RichText } from '@/components/ui/RichText'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { site } from '@/content/site'
import { IS_PRODUCTION } from '@/lib/env'
import type { FigureFrameProps } from './types'
import { figureDomId } from './types'
import { LabelReveal } from './LazyDrawing.client'
import s from './FigureFrame.module.css'

/**
 * Writes the figure DOM contract (src/figures/types.ts, Appendix B §B5) on the
 * server. The figure's own controller (children) and useFigure keep the data-*
 * state up to date on the client.
 *
 * Order inside .box: .drawing (one HTML-level <svg> per layer), .scan-bar,
 * .slot[data-stage-slot] > canvas.still, .labels[aria-hidden], .ui, and
 * .still-wrap > img.still-img (the still tier). The box keeps a fixed aspect
 * ratio from the layout, so nothing shifts when layers arrive.
 *
 * The family switches by container query: wide at or above the figure's
 * family minimum (520 px hero, 440 px services, 560 px everything else).
 */

/** The narrowest container (CSS px) that uses the wide family, per figure. */
export function familyMin(id: FigureId): 440 | 520 | 560 {
  if (id === 'hero') return 520
  if (/^s0[1-6]$/.test(id)) return 440
  return 560
}

/** The title strip's demo stamp: the tag's first word shows, the rest is screen-reader only. */
export function stampParts(tag: string | undefined): { word: string; rest: string } | null {
  const t = tag?.trim()
  if (!t) return null
  const [word = t, ...rest] = t.split(/\s+/)
  return { word, rest: rest.join(' ') }
}

export interface FigureFrameExtras {
  /** Render-time vars for the caption and long description (graph counts, for example). */
  textVars?: Readonly<Record<string, string | number>>
  /** Override the family minimum (CSS px). */
  famMin?: 440 | 520 | 560
}

export function FigureFrame({
  id,
  copy,
  layouts,
  drawing,
  still,
  labels,
  ui,
  table,
  stage,
  driver,
  vars,
  initialRev,
  initialToggle,
  controls,
  className,
  children,
  textVars,
  famMin,
}: FigureFrameProps & FigureFrameExtras) {
  const dom = figureDomId(id)
  const [, , w, h] = layouts.wide
  const tall = layouts.tall ?? layouts.wide
  const style = {
    '--vbw': w,
    '--vbh': h,
    '--vbw-t': tall[2],
    '--vbh-t': tall[3],
    '--p': 0,
    ...vars,
  } as CSSProperties
  const revs = copy.revs as Readonly<Record<string, string>> | undefined
  const showTable = copy.controls?.showTable
  const stamp = stampParts(copy.tag)
  return (
    <figure
      id={dom}
      className={`fig ${s.fig} ${className ?? ''}`.trim()}
      data-figure={id}
      data-phase="waiting"
      data-medium="svg"
      data-stage="svg"
      data-view="plan"
      data-labels="plan"
      data-family="wide"
      data-fam-min={famMin ?? familyMin(id)}
      data-driver={driver}
      data-run="0"
      {...(layouts.tall ? { 'data-has-tall': '' } : {})}
      {...(initialRev ? { 'data-rev': initialRev } : {})}
      {...(initialToggle ? { 'data-toggle': initialToggle } : {})}
      {...(stage ? { 'data-scene': stage.scene, 'data-load': stage.load } : {})}
      style={style}
      aria-labelledby={`${dom}-title`}
      aria-describedby={`${dom}-desc`}
    >
      <div className={`strip ${s.strip}`}>
        {/* one row: the title and its stamp, then the chip and the controls on the right (a
            compact second row when they do not fit). The detail number yields first (still
            read out); the name never trims and wraps only as a last resort; the EXAMPLE or
            SAMPLE stamp never wraps */}
        <p id={`${dom}-title`} className={s.title}>
          <span className={s.detail}>
            {copy.detail}
            <span aria-hidden="true"> · </span>
          </span>
          <span className={s.name}>{copy.title}</span>
          {stamp ? (
            // the stamp shows the tag's first word (EXAMPLE or SAMPLE); the rest is still read
            // out, and the footer's general notes say it in full
            <span className={s.stamp} data-stamp="">
              <span className="sr-only"> · </span>
              {stamp.word}
              {stamp.rest ? <span className="sr-only"> {stamp.rest}</span> : null}
            </span>
          ) : null}
        </p>
        {initialRev && (revs?.[initialRev] || !IS_PRODUCTION) ? (
          // a missing chip string shows its rev key in preview, so the gap is visible
          <span data-rev-chip="" aria-hidden="true" className={s.chip}>
            {revs?.[initialRev] ?? initialRev}
          </span>
        ) : null}
        <div className={`controls ${s.controls}`}>
          {controls?.replay && copy.controls?.replay ? (
            <button type="button" data-action="replay" className={s.button}>
              {copy.controls.replay}
            </button>
          ) : null}
          {controls?.playDrawing && copy.controls?.playDrawing ? (
            <button type="button" data-action="play" className={`${s.button} ${s.play}`}>
              {copy.controls.playDrawing}
            </button>
          ) : null}
          {controls?.motion ? <MotionSwitch variant="strip" label={site.motion.label} /> : null}
          {controls?.extra}
        </div>
      </div>
      <div className={`box ${s.box}`}>
        <div className={`drawing ${s.drawing}`} aria-hidden="true">
          {drawing}
        </div>
        <div className={`scan-bar ${s.scanBar}`} aria-hidden="true" />
        <div className={`slot ${s.slot}`} data-stage-slot="" aria-hidden="true">
          <canvas className="still" />
        </div>
        <div className={`labels ${s.labels}`} aria-hidden="true">
          {labels}
        </div>
        <div className={`ui ${s.ui}`}>{ui}</div>
        <div className={`still-wrap ${s.stillWrap}`}>{still}</div>
      </div>
      <figcaption className={s.caption}>
        <RichText value={copy.caption} vars={textVars} as="span" />
      </figcaption>
      {table ? (
        <details className={s.table}>
          {showTable ? <summary className={s.summary}>{showTable}</summary> : null}
          {table}
        </details>
      ) : null}
      <div id={`${dom}-desc`} className="sr-only">
        {copy.longDescription.map((d, i) => (
          <RichText key={i} value={d} vars={textVars} />
        ))}
      </div>
      <p data-live="" aria-live="polite" className="sr-only" />
      {/* the default label reveal; the hero times its own labels to its scan and its loop
          (a scan reveals by clip, which the watcher cannot see) */}
      {id === 'hero' ? null : <LabelReveal />}
      {children}
    </figure>
  )
}
