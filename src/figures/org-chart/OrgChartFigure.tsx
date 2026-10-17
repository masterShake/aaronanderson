import type { CSSProperties } from 'react'
import { orgChartFigure as copy } from '@/content/figures/org-chart'
import { about } from '@/content/pages/about'
import { GATE, DUR } from '@/motion/timing'
import { drawingSrc } from '@/drawings/files'
import type { LayoutId } from '@/drawings/types'
import { ORG_CARDS, ORG_LAYOUT, ORG_REVS, wireDim, wireEnds } from '@/drawings/views/org-chart'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { OrgChartToggle } from './OrgChartToggle.client'
import s from './org-chart.module.css'

/**
 * The org chart on About (DETAIL 2 / G-02; owner: home-about): the usual
 * chain against ours, one wire long. Each role is a card with a scale figure
 * over its title; the titles are HTML in the cards' title strips. Static
 * drawings in two states, switched by a two-button toggle (aria-pressed); the
 * server renders "ours", so no-JS and still-tier visitors see the point.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const INITIAL = 'ours'
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
const at = (f: number) => Math.round(Math.min(1, Math.max(0, f)) * 1000) / 1000

export function OrgChartFigure() {
  const W = ORG_LAYOUT.wide
  const T = ORG_LAYOUT.tall
  const [, , ww, wh] = W.viewBox
  const [, , tw, th] = T.viewBox
  const labels = copy.labels as Readonly<Record<string, string>>
  const revs = copy.revs as Readonly<Record<string, string>>
  const src = (f: string) => drawingSrc('org-chart', f)
  const titles = ORG_CARDS.filter((c) => labels[c.id]).map((c) => {
    const rw = W.title(W.card(c.slot))
    const rt = T.title(T.card(c.slot))
    const style = {
      '--lx': pct(rw.x, ww),
      '--ly': pct(rw.y, wh),
      '--lw': pct(rw.w, ww),
      '--lh': pct(rw.h, wh),
      '--lxt': pct(rt.x, tw),
      '--lyt': pct(rt.y, th),
      '--lwt': pct(rt.w, tw),
      '--lht': pct(rt.h, th),
      // where the title's middle sits along a change's scan (0 to 1): it changes as the edge
      // passes it (wide left to right, tall top to bottom)
      '--sx': at((rw.x + rw.w / 2) / ww),
      '--sxt': at((rt.y + rt.h / 2) / th),
    } as CSSProperties
    const only = c.revs.length === 1 ? c.revs[0] : undefined
    return (
      <span key={c.id} className={s.node} data-show={only} data-card={c.id} style={style}>
        {labels[c.id] ?? c.id}
      </span>
    )
  })
  // the dimension's label, centred on the dimension line (ours)
  const dw = wireDim('wide', ...wireEnds('wide')).mid
  const dt = wireDim('tall', ...wireEnds('tall')).mid
  const wire = labels.wire ? (
    <span
      key="wire"
      className={s.dim}
      data-show="ours"
      style={
        {
          '--lx': pct(dw[0], ww),
          '--ly': pct(dw[1], wh),
          '--lxt': pct(dt[0], tw),
          '--lyt': pct(dt[1], th),
          '--sx': at(dw[0] / ww),
          '--sxt': at(dt[1] / th),
        } as CSSProperties
      }
    >
      {labels.wire}
    </span>
  ) : null
  const lost = (copy.notes as Readonly<Record<string, string>> | undefined)?.lost
  const note = lost ? (
    <span
      key="lost"
      className={s.note}
      data-show="chain"
      style={
        {
          '--lx': pct(W.note[0], ww),
          '--ly': pct(W.note[1], wh),
          '--lxt': pct(T.note[0], tw),
          '--lyt': pct(T.note[1], th),
          // the note's middle: about 90 units of hand lettering
          '--sx': at((W.note[0] + 90) / ww),
          '--sxt': at((T.note[1] + 10) / th),
          rotate: '-3deg',
        } as CSSProperties
      }
    >
      {lost}
    </span>
  ) : null
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
      layouts={{ wide: W.viewBox, tall: T.viewBox }}
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
          {titles}
          {wire}
          {note}
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
