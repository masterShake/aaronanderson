import type { CSSProperties } from 'react'
import { s06Figure as copy } from '@/content/figures/s06'
import type { LayoutId, Pt } from '@/drawings/types'
import { buildS06Model, S06_ADDS, S06_VIEWBOX } from '@/drawings/views/s06'
import { fitIso, isoToViewBox, planToWorld } from '@/drawings/lib/iso'
import { modelBounds } from '@/drawings/render'
import { drawingSrc } from '@/drawings/files'
import { FigureFrame } from '@/figures/FigureFrame'
import { FigureBoundary } from '@/figures/FigureBoundary.client'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { RichText } from '@/components/ui/RichText'
import { S06 } from '@/motion/timing/s06'
import { cssVars } from '@/motion/timing-css'
import { S06Controller } from './S06Controller.client'
import s from './s06.module.css'

/**
 * DETAIL 6 / S-06, Run & Improve (pages-drawings §6.6, stage-hero §4.4): the hero's rewired
 * machine under a monthly inspection. Scroll (or, below 1024 px, play on entry) draws the
 * CAD plan to p .15 (the WebGL hand-off), then the iso print; from p .40 an inspection light
 * sweeps three times (the flange is FIXED on the last) and each further .15 bolts on a month's
 * instrument. The health card shows labels only. Labels sit on the print (iso positions).
 */

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

function isoLabels(family: LayoutId) {
  const m = buildS06Model(family)
  const vb = S06_VIEWBOX[family]
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(m.spec))
  const at = (key: string): Pt => {
    const part = m.spec.parts.find((p) => p.anchor === key)!
    const prim = part.prims[0]!
    const c: Pt = prim.t === 'circle' ? prim.c : [0, 0]
    const q = isoToViewBox(planToWorld(c, (part.z ?? 0) + part.depth), vb, fit)
    return [pct(q[0], vb[2]), pct(q[1], vb[3])]
  }
  return { at }
}

export function S06Figure() {
  const w = isoLabels('wide')
  const t = isoLabels('tall')
  const place = (key: string, dy = -5, dyt = -5) => {
    const a = w.at(key)
    const b = t.at(key)
    return {
      '--lx': a[0],
      '--ly': a[1] + dy,
      '--lxt': b[0],
      '--lyt': b[1] + dyt,
    } as CSSProperties
  }
  const month = (n: number) => S06.monthFromP + n * S06.monthStepP
  const vars = cssVars(S06, 's06')
  const still = (family: LayoutId) => (
    <img
      key={family}
      src={drawingSrc('s06', `${family}.print.still.svg`)}
      alt=""
      loading="lazy"
      className="still-img"
      data-family={family}
    />
  )
  return (
    <FigureFrame
      id="s06"
      copy={copy}
      className={s.s06}
      layouts={{ wide: S06_VIEWBOX.wide, tall: S06_VIEWBOX.tall }}
      driver="scroll"
      stage={{ scene: 's06', load: 'near', mode: 'scrub' }}
      vars={vars}
      controls={{ replay: true, motion: true }}
      drawing={
        <LazyDrawing
          src={drawingSrc('s06', 'wide.json')}
          tallSrc={drawingSrc('s06', 'tall.json')}
          stillSrc={drawingSrc('s06', 'wide.print.still.svg')}
        />
      }
      labels={
        <>
          <span className={s.band}>
            <span className={s.bandTag}>{copy.labels.inspection}</span>
          </span>
          <span className={`${s.lab} ${s.gauge}`} style={place('gauge', -7, -7)}>
            {copy.labels.gauge}
          </span>
          <span className={`${s.lab} ${s.fixed}`} style={place('fixed', -6, -6)}>
            {copy.labels.fixed}
          </span>
          {S06_ADDS.map((key, i) => (
            <span
              key={key}
              className={`${s.lab} ${s.add}`}
              style={{ ...place(key, -6, -5), '--a': month(i + 1) } as CSSProperties}
            >
              {copy.labels[key]}
            </span>
          ))}
        </>
      }
      ui={
        <>
          <div className={s.health} aria-hidden="true">
            <p className={s.healthTitle}>{copy.ui.healthTitle}</p>
            <p>{copy.ui.synced}</p>
            <p>{copy.ui.fixes}</p>
            <p>{copy.ui.shipped}</p>
          </div>
          <div className={s.months} aria-hidden="true">
            <span className={s.monthsTag}>{copy.labels.months}</span>
            <span className={s.ticks}>
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className={s.tick}
                  style={{ '--a': i < 3 ? month(i + 1) : 2 } as CSSProperties}
                />
              ))}
            </span>
            <span className={s.monthNow}>
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={s.month}
                  style={{ '--a': month(n), '--b': n < 3 ? month(n + 1) : 2 } as CSSProperties}
                >
                  <RichText value={copy.ui.month} vars={{ month: n }} as="span" />
                </span>
              ))}
            </span>
          </div>
        </>
      }
      still={
        <>
          {still('wide')}
          {still('tall')}
        </>
      }
    >
      <FigureBoundary figureId="s06">
        <S06Controller />
      </FigureBoundary>
    </FigureFrame>
  )
}
