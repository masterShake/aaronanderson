import type { CSSProperties, ReactNode } from 'react'
import { COLOR, PEN } from '@/styles/tokens'
import { DEMO_CSS_WIDTH, DEMO_PEN, DEMO_VIEWBOX, demoSegments } from './demo-plan'
import { DemoStage } from './DemoStage.client'
import s from './stage.module.css'

/**
 * The demo figure: the §B5 DOM order with one CAD layer drawn from
 * demo-plan.ts, an empty stage slot and a label layer. Preview only.
 */
export function DemoFigure({ caption }: { caption: ReactNode }) {
  const [x, y, w, h] = DEMO_VIEWBOX
  const style = {
    '--vbw': w,
    '--vbh': h,
    '--k': 1,
    '--demo-w': `${DEMO_CSS_WIDTH}px`,
    '--p': 0,
  } as CSSProperties
  return (
    <figure
      id="fig-stage-demo"
      className={`fig ${s.fig}`}
      data-figure="stage-demo"
      data-phase="waiting"
      data-medium="svg"
      data-stage="svg"
      data-view="plan"
      data-labels="plan"
      data-family="wide"
      data-run="0"
      data-scene="_demo"
      data-load="near"
      data-handoff-p="0.5"
      style={style}
      aria-labelledby="fig-stage-demo-caption"
    >
      <div className={`box ${s.box}`}>
        <div className="drawing" aria-hidden="true">
          <svg
            className={`l-cad ${s.cad}`}
            viewBox={`${x} ${y} ${w} ${h}`}
            style={{ '--k': 1, '--demo-pen': PEN[DEMO_PEN] } as CSSProperties}
            stroke={COLOR.cyan}
            strokeWidth={PEN[DEMO_PEN]}
            strokeLinecap="round"
            fill="none"
          >
            {demoSegments().map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </svg>
        </div>
        <div className="slot" data-stage-slot="" aria-hidden="true">
          <canvas className="still" />
        </div>
        <div className="labels" aria-hidden="true" />
      </div>
      <figcaption id="fig-stage-demo-caption" className={s.caption}>
        {caption}
      </figcaption>
      <DemoStage />
    </figure>
  )
}
