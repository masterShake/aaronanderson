import type { CSSProperties } from 'react'
import { RichText } from '@/components/ui/RichText'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { site } from '@/content/site'
import type { FigureFrameProps } from './types'
import { figureDomId } from './types'
import s from './FigureFrame.module.css'

/**
 * Writes the figure DOM contract (src/figures/types.ts) on the server. The
 * figure's own controller (children) and useFigure keep the data-* state up
 * to date on the client. W0 minimal markup; owner: drawings lane.
 */
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
}: FigureFrameProps) {
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
      data-driver={driver}
      data-run="0"
      {...(initialRev ? { 'data-rev': initialRev } : {})}
      {...(initialToggle ? { 'data-toggle': initialToggle } : {})}
      {...(stage ? { 'data-scene': stage.scene, 'data-load': stage.load } : {})}
      style={style}
      aria-labelledby={`${dom}-title`}
      aria-describedby={`${dom}-desc`}
    >
      <div className={`strip ${s.strip}`}>
        <p id={`${dom}-title`} className={s.title}>
          {copy.detail} · {copy.title}
          {copy.tag ? <> · {copy.tag}</> : null}
        </p>
        {initialRev && copy.revs ? (
          <span data-rev-chip="" aria-hidden="true" className={s.title}>
            {(copy.revs as Readonly<Record<string, string>>)[initialRev]}
          </span>
        ) : null}
        <div className="controls">
          {controls?.replay && copy.controls?.replay ? (
            <button type="button" data-action="replay">
              {copy.controls.replay}
            </button>
          ) : null}
          {controls?.playDrawing && copy.controls?.playDrawing ? (
            <button type="button" data-action="play">
              {copy.controls.playDrawing}
            </button>
          ) : null}
          {controls?.motion ? <MotionSwitch variant="strip" label={site.motion.label} /> : null}
          {controls?.extra}
        </div>
      </div>
      <div className={`box ${s.box}`}>
        <div className="drawing" aria-hidden="true">
          {drawing}
        </div>
        <div className="scan-bar" aria-hidden="true" />
        <div className="slot" data-stage-slot="" aria-hidden="true">
          <canvas className="still" />
        </div>
        <div className="labels" aria-hidden="true">
          {labels}
        </div>
        <div className="ui">{ui}</div>
        <div className="still">{still}</div>
      </div>
      <figcaption className={s.caption}>
        <RichText value={copy.caption} as="span" />
      </figcaption>
      {table ? <details>{table}</details> : null}
      <div id={`${dom}-desc`} className="sr-only">
        {copy.longDescription.map((d, i) => (
          <RichText key={i} value={d} />
        ))}
      </div>
      <p data-live="" aria-live="polite" className="sr-only" />
      {children}
    </figure>
  )
}
