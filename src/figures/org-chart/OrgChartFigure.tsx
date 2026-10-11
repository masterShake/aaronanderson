import type { CSSProperties } from 'react'
import { orgChartFigure as copy } from '@/content/figures/org-chart'
import { about } from '@/content/pages/about'
import { GATE, DUR } from '@/motion/timing'
import { drawingSrc } from '@/drawings/files'
import { nodeRect } from '@/drawings/lib/route'
import type { LayoutId } from '@/drawings/types'
import { orgChartGraph as g, ORG_REVS } from '@/drawings/views/org-chart'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { OrgChartToggle } from './OrgChartToggle.client'
import s from './org-chart.module.css'

/**
 * The org chart on About (DETAIL 1 / G-02; owner: home-about): the usual
 * chain against ours, one wire long. Static drawings in two states, switched
 * by a two-button toggle (aria-pressed); the server renders "ours", so no-JS
 * and still-tier visitors see the point. Labels are HTML over the boxes.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const INITIAL = 'ours'
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

export function OrgChartFigure() {
  const [, , ww, wh] = g.viewBox.wide
  const [, , tw, th] = g.viewBox.tall
  const labels = copy.labels as Readonly<Record<string, string>>
  const revs = copy.revs as Readonly<Record<string, string>>
  const src = (f: string) => drawingSrc('org-chart', f)
  const nodeLabels = g.nodes.map((n) => {
    const rw = nodeRect(n, 'wide')
    const rt = nodeRect(n, 'tall')
    const style = {
      '--lx': pct(rw.x, ww),
      '--ly': pct(rw.y, wh),
      '--lw': pct(rw.w, ww),
      '--lh': pct(rw.h, wh),
      '--lxt': pct(rt.x, tw),
      '--lyt': pct(rt.y, th),
      '--lwt': pct(rt.w, tw),
      '--lht': pct(rt.h, th),
    } as CSSProperties
    const only = n.revs?.length === 1 ? n.revs[0] : undefined
    return (
      <span key={n.id} className={s.node} data-show={only} style={style}>
        {labels[n.label] ?? n.label}
      </span>
    )
  })
  const notes = (g.notes ?? []).flatMap((n) => {
    const text = (copy.notes as Readonly<Record<string, string>> | undefined)?.[n.key]
    if (!text) return []
    const style = {
      '--lx': pct(n.at[0], ww),
      '--ly': pct(n.at[1], wh),
      '--lxt': pct((n.atTall ?? n.at)[0], tw),
      '--lyt': pct((n.atTall ?? n.at)[1], th),
      rotate: `${n.rotate}deg`,
    } as CSSProperties
    return [
      <span key={n.key} className={s.note} data-show="chain" style={style}>
        {text}
      </span>,
    ]
  })
  const still = FAMILIES.flatMap((fam) =>
    ORG_REVS.map((rev) => (
      // static SVG stills from /drawings/[file]; next/image would add nothing
      <img
        key={`${fam}-${rev}`}
        src={src(`${fam}.${rev}.still.svg`)}
        alt=""
        loading="lazy"
        className="still-img"
        data-family={fam}
        data-show={rev}
      />
    )),
  )
  const t = about.orgChart.toggle
  return (
    <FigureFrame
      id="org-chart"
      copy={copy}
      layouts={{ wide: g.viewBox.wide, tall: g.viewBox.tall }}
      driver="input"
      initialRev={INITIAL}
      initialToggle={INITIAL}
      className={s.org}
      drawing={
        <LazyDrawing
          src={src('wide.json')}
          tallSrc={src('tall.json')}
          stillSrc={src(`wide.${INITIAL}.still.svg`)}
        />
      }
      still={still}
      labels={
        <>
          {nodeLabels}
          {notes}
        </>
      }
      controls={{
        extra: (
          <OrgChartToggle
            figure="fig-org-chart"
            label={String(copy.ui.toggleLabel)}
            options={[
              { value: 'chain', label: t.usual },
              { value: 'ours', label: t.ours },
            ]}
            initial={INITIAL}
            from="chain"
            chips={revs}
            delay={DUR.state}
            threshold={GATE.handoffVisible}
          />
        ),
      }}
    />
  )
}
