import type { CSSProperties, ReactNode } from 'react'
import type { Rich } from '@/content/types'
import { s01Figure as copy } from '@/content/figures/s01'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { drawingSrc } from '@/drawings/files'
import { cssVars } from '@/motion/timing-css'
import { S01 } from '@/motion/timing/s01'
import { fill } from '@/components/schematic/copy'
import {
  S01_BY_HAND,
  S01_CLOUDED,
  S01_COUNTS,
  S01_ITEMS,
  S01_LIST,
  S01_NOTES,
  S01_ROADMAP_DAYS,
  S01_TOOLS,
  S01_VB,
  cloudTagAt,
  crossP,
  scanX,
  tagAt,
  toolLabelAt,
  type S01Pos,
} from '@/drawings/views/s01'
import { ScrubPlay } from './ScrubPlay.client'
import s from './s01.module.css'

/**
 * DETAIL 1 / S-01 · THE SURVEY (pages-drawings §6.1). SVG only: sketch, survey
 * sweep, clouds Δ1–Δ3, the redraw on the deep panel, then the ranked list
 * (EXAMPLE) and the 90-day roadmap. --p drives every beat (scrubbed on the
 * sheet at 1024 px and up, played over S01.playMs elsewhere); the still is p = 1.
 */

const str = (v: Rich): string => (typeof v === 'string' ? v : v.text)
const pos = (p: S01Pos) => ({
  '--lx': p.wide[0],
  '--ly': p.wide[1],
  '--lxt': p.tall[0],
  '--lyt': p.tall[1],
})
const css = (o: Record<string, string | number>) => o as CSSProperties
const nn = (n: number) => String(n).padStart(2, '0')
const LEVELS = ['small', 'medium', 'large'] as const

const file = (f: string) => drawingSrc('s01', f)

function Meter({ label, level }: { label: string; level: 1 | 2 | 3 }) {
  return (
    <span className={s.meter}>
      <span>{label}</span>
      <span className={s.bars} data-level={level} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{str(copy.ui[LEVELS[level - 1]!])}</span>
    </span>
  )
}

function Labels() {
  const ui = copy.ui
  const out: ReactNode[] = []
  S01_TOOLS.forEach((tool, idx) => {
    const at = toolLabelAt(tool)
    const sx = scanX(at)
    const a = S01.sketchFromP + (idx + 2) * S01.sketchStaggerP * 1.5
    out.push(
      <span
        key={`t.${tool}`}
        className={s.tool}
        style={css({
          ...pos(at),
          '--a': a,
          '--b': a + S01.sketchStrokeP,
          '--sx': sx.wide[0],
          '--sxt': sx.tall[0],
        })}
      >
        {copy.labels[`tool.${tool}`]}
      </span>,
    )
    const k = S01_BY_HAND.find((x) => x.tool === tool)?.k ?? 0
    const tag = tagAt(tool)
    const tx = scanX(tag)
    out.push(
      <span
        key={`g.${tool}`}
        className={s.tag}
        style={css({
          ...pos(tag),
          '--a': crossP(tool, 'wide'),
          '--at': crossP(tool, 'tall'),
          '--sx': tx.wide[0],
          '--sxt': tx.tall[0],
        })}
      >
        {fill(str(ui.toolTag), { nn: nn(idx + 1), k })}
      </span>,
    )
  })
  S01_CLOUDED.forEach((tool, i) => {
    const key = `cloud.${i + 1}` as 'cloud.1' | 'cloud.2' | 'cloud.3'
    out.push(
      <span key={key} className={s.delta} style={css({ ...pos(cloudTagAt(tool)), '--i': i })}>
        {copy.labels[key]}
      </span>,
    )
  })
  out.push(
    <span
      key="n.head"
      className={`note ${s.note}`}
      style={css({ ...pos(S01_NOTES.head), '--tilt': '-1.5deg' })}
    >
      {copy.notes.head}
    </span>,
    <span
      key="n.version"
      className={`note ${s.note}`}
      style={css({ ...pos(S01_NOTES.version), '--tilt': '1.2deg' })}
    >
      {copy.notes.version}
    </span>,
    <span key="s.written" className={s.spec} style={css(pos(S01_NOTES.head))}>
      {copy.labels['spec.written']}
    </span>,
    <span key="s.one" className={s.spec} style={css(pos(S01_NOTES.version))}>
      {copy.labels['spec.oneSource']}
    </span>,
  )
  const days = S01_ROADMAP_DAYS
  out.push(
    <div key="list" className={s.list} style={css(pos(S01_LIST))}>
      <p className={s.listHead}>
        <span>{str(ui.listTitle)}</span>
        <span className={s.example}>{str(ui.listTag)}</span>
      </p>
      <ol className={s.items}>
        {S01_ITEMS.map((it, i) => (
          <li
            key={it.key}
            className={s.item}
            style={css({
              '--a': S01.itemFromP + i * S01.itemStepP,
              '--b': S01.itemFromP + i * S01.itemStepP + S01.itemP,
            })}
          >
            <span className={s.bubble} aria-hidden="true">
              {i + 1}
            </span>
            <span className={s.itemText}>{str(ui[it.key])}</span>
            <span className={s.meters}>
              <Meter label={str(ui.effort)} level={it.effort} />
              <Meter label={str(ui.payoff)} level={it.payoff} />
            </span>
          </li>
        ))}
      </ol>
      <div className={s.roadmap}>
        <p className={s.roadmapTitle}>{str(ui.roadmap)}</p>
        <div className={s.dimString} aria-hidden="true">
          <span className={s.dimRun} />
          {days.slice(1).map((d, i) => (
            <span key={d} className={s.span} style={css({ '--n': i })}>
              <span className={s.bubble}>{i + 1}</span>
            </span>
          ))}
        </div>
        <p className={s.ticks}>
          {days.map((d, i) => (
            <span key={d}>
              {fill(str(ui.dayTick), { n: d })}
              {i === days.length - 1 ? ` ${str(ui.days)}` : null}
            </span>
          ))}
        </p>
      </div>
    </div>,
  )
  return <>{out}</>
}

export function S01Figure() {
  const textVars = {
    tools: S01_COUNTS.tools,
    handoffs: S01_COUNTS.handoffs,
    bottlenecks: S01_COUNTS.bottlenecks,
  }
  return (
    <FigureFrame
      id="s01"
      copy={copy}
      className={s.fig}
      layouts={{ wide: S01_VB.wide, tall: S01_VB.tall }}
      driver="scroll"
      vars={cssVars(S01, 's01')}
      textVars={textVars}
      controls={{ replay: true }}
      drawing={
        <LazyDrawing
          src={file('wide.json')}
          tallSrc={file('tall.json')}
          stillSrc={file('wide.surveyed.still.svg')}
        />
      }
      labels={<Labels />}
      still={
        <>
          <img
            src={file('wide.surveyed.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="wide"
          />
          <img
            src={file('tall.surveyed.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="tall"
          />
        </>
      }
    >
      <ScrubPlay id="s01" playMs={S01.playMs} />
    </FigureFrame>
  )
}
