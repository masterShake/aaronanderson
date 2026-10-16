import type { CSSProperties } from 'react'
import { strataFigure as copy } from '@/content/figures/strata'
import { STRATA_LAYOUT, strataDoc, strataLabelAt } from '@/drawings/views/strata'
import { FigureFrame } from '@/figures/FigureFrame'
import { InlineDrawing } from '@/figures/InlineDrawing'
import s from './strata.module.css'

/**
 * The strata on About (DETAIL 1 / G-02; owner: home-about): a section cut
 * through field, office and code. Static (no draw-on, no controller), so it is
 * drawn inline on the server, both families, like the hero: the finished
 * drawing is in the first paint at every tier, with no layer bundle and no
 * still image to fetch. On phones it sits in the first screen, where a lazy
 * still was the page's LCP element (W4b A1). The band annotations (HOLDs) sit
 * beside the figure in the section.
 */

const KEYS = ['section', 'code', 'office', 'field'] as const
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

export function StrataFigure() {
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
      drawing={<InlineDrawing doc={strataDoc('wide')} tall={strataDoc('tall')} />}
      // the inline drawing is its own still (strata.module.css keeps it on the still tier)
      still={null}
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
