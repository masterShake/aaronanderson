import type { CSSProperties } from 'react'
import { s06Figure as copy } from '@/content/figures/s06'
import type { LayoutId, Pt } from '@/drawings/types'
import { buildS06Model, partTop, S06_ADDS, S06_NAMES, S06_VIEWBOX } from '@/drawings/views/s06'
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
 * machine under a monthly inspection. The CAD plan, with its names, is complete at p = 0 (its
 * still stands in until the layers load); scroll (or, below 1024 px, play on entry) holds it to
 * p .15 (the WebGL hand-off), then the iso print with its tool names; from p .40 an
 * inspection light sweeps three times (a fault shows at the flange on the last, then FIXED) and
 * each further .15 bolts on a month's instrument. The health card ticks as each thing happens
 * and shows labels only. Labels sit on the print (iso positions) or, in WebGL, on the Stage's
 * projected anchors (the hero's label keys).
 */

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

function isoLabels(family: LayoutId) {
  const m = buildS06Model(family)
  const vb = S06_VIEWBOX[family]
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(m.spec), S06.isoPad)
  /** The anchor's print position; undefined where the family has no such part (tall: no CRM). */
  const at = (key: string): Pt | undefined => {
    const part = m.spec.parts.find((p) => p.anchor === key)
    if (!part) return undefined
    const { c, z } = partTop(part)
    const q = isoToViewBox(planToWorld(c, z), vb, fit)
    return [pct(q[0], vb[2]), pct(q[1], vb[3])]
  }
  /**
   * The part's centre on the CAD plan (before the print), or undefined. The owner's report's
   * name is nearly as wide as its box: it sits a little low, under the line of its chart glyph
   * (s06Glyphs: the glyph ends 14.5 fortieths of the box's short side in), so the two never
   * touch.
   */
  const plan = (key: string): Pt | undefined => {
    const part = m.spec.parts.find((p) => p.anchor === key)
    if (!part) return undefined
    let { c } = partTop(part)
    const q = part.prims[0]
    if (key === 'tool.report' && q?.t === 'rect') c = [c[0], q.at[1] + q.size[1] * 0.64]
    return [pct(c[0], vb[2]), pct(c[1], vb[3])]
  }
  return { at, plan }
}

export function S06Figure() {
  const w = isoLabels('wide')
  const t = isoLabels('tall')
  /** Label position (percent of the box) at its anchor; CSS sets each kind's offset. */
  const place = (key: string) => {
    const a = w.at(key)!
    const b = t.at(key) ?? a
    return { '--lx': a[0], '--ly': a[1], '--lxt': b[0], '--lyt': b[1] } as CSSProperties
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
        <>
          {/* the plan, complete, until the layers load (never an empty panel) */}
          {(['wide', 'tall'] as const).map((f) => (
            <img
              key={f}
              src={drawingSrc('s06', `${f}.start.still.svg`)}
              alt=""
              loading="lazy"
              className={s.start}
              data-family={f}
            />
          ))}
          <LazyDrawing
            src={drawingSrc('s06', 'wide.json')}
            tallSrc={drawingSrc('s06', 'tall.json')}
            stillSrc={drawingSrc('s06', 'wide.print.still.svg')}
          />
        </>
      }
      labels={
        <>
          <span className={s.band} />
          <span className={s.inspectTag}>{copy.labels.inspection}</span>
          {S06_NAMES.map((key) => {
            // the same names on the CAD plan, until the hand-off tilts it (no data-anchor)
            const a = w.plan(key)!
            const b = t.plan(key)
            const style = {
              '--lx': a[0],
              '--ly': a[1],
              '--lxt': (b ?? a)[0],
              '--lyt': (b ?? a)[1],
            } as CSSProperties
            return (
              <span
                key={`plan.${key}`}
                className={`${s.lab} ${s.planName}`}
                data-key={key}
                {...(b ? {} : { 'data-wide-only': '' })}
                style={style}
              >
                {copy.labels[key]}
              </span>
            )
          })}
          {S06_NAMES.map((key) => (
            <span key={key} className={`${s.lab} ${s.name}`} data-anchor={key} style={place(key)}>
              {copy.labels[key]}
            </span>
          ))}
          <span className={`${s.lab} ${s.fixWrap}`} data-anchor="fixed" style={place('fixed')}>
            <span className={s.fault} />
            <span className={s.fixed}>{copy.labels.fixed}</span>
          </span>
          {S06_ADDS.map((key, i) => (
            <span
              key={key}
              data-anchor={key}
              className={`${s.lab} ${s.add}`}
              style={{ ...place(key), '--a': month(i + 1) } as CSSProperties}
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
            <p>
              {copy.ui.synced} <span className={`${s.ok} ${s.okSync}`}>{copy.ui.tick}</span>
            </p>
            <p>
              {copy.ui.gauges} <span className={`${s.ok} ${s.okSync}`}>{copy.ui.tick}</span>
            </p>
            <p>
              {copy.ui.fixes} <span className={`${s.ok} ${s.okFix}`}>{copy.ui.tick}</span>
            </p>
            <p>
              {copy.ui.shipped}{' '}
              <span className={`${s.ok} ${s.okShip}`} style={{ '--a': month(1) } as CSSProperties}>
                {copy.ui.tick}
              </span>
            </p>
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
