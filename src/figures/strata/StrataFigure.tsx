import type { CSSProperties } from 'react'
import { strataFigure as copy } from '@/content/figures/strata'
import { drawingSrc } from '@/drawings/files'
import type { LayoutId } from '@/drawings/types'
import { STRATA_LAYOUT, STRATA_REV, strataLabelAt } from '@/drawings/views/strata'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import s from './strata.module.css'

/**
 * The strata on About (DETAIL 2 / G-02; owner: home-about): a section cut
 * through field, office and code. Static (no draw-on, no controller): the base
 * state is the finished drawing, and the still stands in until the layers
 * arrive. The band annotations (HOLDs) sit beside the figure in the section.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const KEYS = ['section', 'code', 'office', 'field'] as const
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

export function StrataFigure() {
  const src = (f: string) => drawingSrc('strata', f)
  const labels = copy.labels as Readonly<Record<string, string>>
  const [, , ww, wh] = STRATA_LAYOUT.wide.viewBox
  const [, , tw, th] = STRATA_LAYOUT.tall.viewBox
  return (
    <FigureFrame
      id="strata"
      copy={copy}
      layouts={{ wide: STRATA_LAYOUT.wide.viewBox, tall: STRATA_LAYOUT.tall.viewBox }}
      driver="input"
      className={s.strata}
      drawing={
        <LazyDrawing
          src={src('wide.json')}
          tallSrc={src('tall.json')}
          stillSrc={src(`wide.${STRATA_REV}.still.svg`)}
        />
      }
      still={FAMILIES.map((fam) => (
        // static SVG stills from /drawings/[file]; next/image would add nothing
        <img
          key={fam}
          src={src(`${fam}.${STRATA_REV}.still.svg`)}
          alt=""
          loading="lazy"
          className="still-img"
          data-family={fam}
        />
      ))}
      labels={KEYS.map((k) => {
        const w = strataLabelAt('wide', k)
        const t = strataLabelAt('tall', k)
        const style = {
          '--lx': pct(w[0], ww),
          '--ly': pct(w[1], wh),
          '--lxt': pct(t[0], tw),
          '--lyt': pct(t[1], th),
        } as CSSProperties
        return (
          <span key={k} className={k === 'section' ? s.cut : s.band} style={style}>
            {labels[k]}
          </span>
        )
      })}
    />
  )
}
