import type { CSSProperties } from 'react'
import { s04Figure as copy } from '@/content/figures/s04'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { drawingSrc } from '@/drawings/files'
import type { LayoutId } from '@/drawings/types'
import { S04 } from '@/motion/timing/s04'
import {
  S04_DIALS,
  S04_END,
  S04_LAYOUT,
  S04_QUESTIONS,
  S04_READINGS,
  S04_TILES,
  type Rect,
  type S04Question,
} from '@/drawings/views/s04'
import { S04Controller, type S04Geo } from './S04Controller.client'
import s from './S04Figure.module.css'

/**
 * S-04 Data & Dashboards (owner: scenes-a). Five reports lock into one panel over one
 * data store; three dials read LOW, IN RANGE or CHECK (words, never numbers); question
 * chips give scripted SAMPLE answers at once, in a polite live region. SVG for every
 * visitor while SHIP.s04 is 'svg' (the WebGL instrument panel is an optional milestone).
 * Labels are HTML (aria-hidden); the long description carries the meaning.
 */

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
const L = S04_LAYOUT

/** Position and size vars for a rect, in both families. */
function rectVars(wide: Rect, tall: Rect): CSSProperties {
  const [, , ww, wh] = L.wide.viewBox
  const [, , tw, th] = L.tall.viewBox
  return {
    '--lx': pct(wide[0], ww),
    '--ly': pct(wide[1], wh),
    '--lw': pct(wide[2], ww),
    '--lh': pct(wide[3], wh),
    '--lxt': pct(tall[0], tw),
    '--lyt': pct(tall[1], th),
    '--lwt': pct(tall[2], tw),
    '--lht': pct(tall[3], th),
  } as CSSProperties
}

/** The store's label sits on the shell, between the left head seam and the sight glass. */
const storeRect = ([x, y, w, h]: Rect): Rect => [x + h / 2 + 6, y, w * 0.8 - h / 2 - 12, h]
/** The report's label sits under the card's orange tab, above its drawn chart. */
const reportRect = ([x, y, w, h]: Rect): Rect => [x, y + h * 0.12, w, h * 0.42]

/** A tile's start offset (percent of the box) and tilt, in both families. */
function tileFrom(t: (typeof S04_TILES)[number]): CSSProperties {
  const d = (f: LayoutId) => {
    const { at, from } = L[f].tiles[t]
    return [pct(from[0] - at[0], L[f].viewBox[2]), pct(from[1] - at[1], L[f].viewBox[3])]
  }
  const [wx, wy] = d('wide')
  const [tx, ty] = d('tall')
  return {
    '--dxw': wx,
    '--dyw': wy,
    '--dxt': tx,
    '--dyt': ty,
    '--rot': L.wide.tiles[t].rot,
  } as CSSProperties
}

const VARS = {
  '--s04-handoff-p': S04.handoffP,
  '--s04-sketch-a': S04.sketchA,
  '--s04-sketch-b': S04.sketchB,
  '--s04-lock-a': S04.lockA,
  '--s04-lock-b': S04.lockB,
  '--s04-scan-a': S04.scanA,
  '--s04-scan-b': S04.scanB,
  '--s04-names-a': S04.namesA,
  '--s04-names-b': S04.namesB,
  '--s04-tank-a': S04.tankA,
  '--s04-tank-b': S04.tankB,
  '--s04-needle-ms': `${S04.needleMs}ms`,
} as const

function geo(f: LayoutId): S04Geo {
  const l = L[f]
  return {
    tiles: S04_TILES.map((t) => {
      const { at, from, rot } = l.tiles[t]
      return { part: `tile.${t}`, dx: from[0] - at[0], dy: from[1] - at[1], rot }
    }),
    riser: Math.abs(l.risers[0]![0][1] - l.risers[0]![1][1]),
  }
}

const TILE_LABEL = {
  accounting: 'tile.accounting',
  pm: 'tile.pm',
  timesheets: 'tile.timesheets',
  estimate: 'tile.estimate',
  payroll: 'tile.payroll',
} as const
const DIAL_LABEL = { cost: 'dial.cost', schedule: 'dial.schedule', hours: 'dial.hours' } as const
const READING = { low: 'low', in: 'inRange', check: 'check' } as const
const QUESTIONS = Object.keys(S04_QUESTIONS) as S04Question[]
const CELLS = ['cell.chart', 'cell.list'] as const

export function S04Figure() {
  const ui = copy.ui
  const labels = (
    <>
      {S04_TILES.map((t, i) => (
        <span
          key={t}
          data-anchor={TILE_LABEL[t]}
          className={s.tl}
          style={
            {
              ...rectVars(L.wide.tiles[t].at, L.tall.tiles[t].at),
              ...tileFrom(t),
              '--i': i,
            } as CSSProperties
          }
        >
          <span className={`${s.tlt} pv`}>{copy.labels[TILE_LABEL[t]]}</span>
        </span>
      ))}
      {S04_DIALS.map((d) => (
        <span
          key={d}
          data-anchor={DIAL_LABEL[d]}
          className={`${s.dn} pv fade`}
          style={rectVars(L.wide.names[d], L.tall.names[d])}
        >
          {copy.labels[DIAL_LABEL[d]]}
        </span>
      ))}
      {S04_DIALS.map((d) => (
        <span
          key={`r-${d}`}
          data-anchor={`reading.${d}`}
          data-dial={d}
          className={`${s.rd} pv fade`}
          style={rectVars(L.wide.readings[d], L.tall.readings[d])}
        >
          {S04_READINGS.map((r) => (
            <span key={r} data-v={r} {...(S04_END[d] === r ? { 'data-end': '' } : {})}>
              {ui[READING[r]]}
            </span>
          ))}
        </span>
      ))}
      {CELLS.map((k, i) => (
        <span
          key={k}
          data-anchor={k}
          className={`${s.dn} pv fade`}
          style={rectVars(L.wide.cellNames[i]!, L.tall.cellNames[i]!)}
        >
          {copy.labels[k]}
        </span>
      ))}
      <span
        data-anchor="store"
        className={`${s.st} pv fade`}
        style={rectVars(storeRect(L.wide.tank), storeRect(L.tall.tank))}
      >
        {copy.labels.store}
      </span>
      <span
        data-anchor="report"
        className={s.rp}
        style={rectVars(reportRect(L.wide.card), reportRect(L.tall.card))}
      >
        {copy.labels.report}
      </span>
    </>
  )
  return (
    <FigureFrame
      id="s04"
      copy={copy}
      className={s.s04}
      layouts={{ wide: L.wide.viewBox, tall: L.tall.viewBox }}
      driver="scroll"
      stage={{ scene: 's04', load: 'near', mode: 'scrub' }}
      vars={VARS}
      textVars={{ tiles: S04_TILES.length }}
      controls={{
        replay: true,
        playDrawing: true,
        motion: true,
        extra: copy.controls.runAgain ? (
          <button type="button" data-action="run-again" className={s.runAgain}>
            {copy.controls.runAgain}
          </button>
        ) : null,
      }}
      drawing={
        <LazyDrawing
          src={drawingSrc('s04', 'wide.json')}
          tallSrc={drawingSrc('s04', 'tall.json')}
          stillSrc={drawingSrc('s04', 'wide.still.svg')}
        />
      }
      still={
        <>
          <img
            src={drawingSrc('s04', 'wide.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="wide"
          />
          <img
            src={drawingSrc('s04', 'tall.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="tall"
          />
        </>
      }
      labels={labels}
    >
      <div className={s.ask} role="group" aria-label={String(ui.chipsLabel)}>
        {QUESTIONS.map((q) => (
          <button key={q} type="button" data-q={q} aria-pressed="false" className={s.chip}>
            {ui[`q.${q}`]}
          </button>
        ))}
      </div>
      <div className={s.answers} aria-live="polite" data-answers="">
        {QUESTIONS.map((q, i) => (
          <div key={q} data-a={q} className={s.answer} {...(i === 0 ? { 'data-first': '' } : {})}>
            <span className={s.stamp}>{ui.answerLabel}</span>
            <p className={s.text}>{ui[`a.${q}`]}</p>
          </div>
        ))}
      </div>
      <S04Controller
        geo={{ wide: geo('wide'), tall: geo('tall') }}
        done={String(copy.live?.done ?? '')}
      />
    </FigureFrame>
  )
}
