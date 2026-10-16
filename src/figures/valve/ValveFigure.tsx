import type { CSSProperties, ReactNode } from 'react'
import { valveFigure as copy } from '@/content/figures/valve'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { drawingSrc } from '@/drawings/files'
import { VALVE_LAYOUT } from '@/drawings/views/valve'
import { VALVE } from '@/motion/timing/ticket'
import { cssVars } from '@/motion/timing-css'
import { ValveController } from './ValveController.client'
import s from './valve.module.css'

/**
 * DETAIL 2 / P-00: where the machine stops and a person signs. A detail
 * drawing on deep: records leave an in-tray, pass an AI reader and a
 * tolerance gauge, and are filed in the system of record; the one outside
 * tolerance goes down a branch to the sign-off valve and waits for a person.
 * Plays once on entry; the logbook (HTML) prints as it goes.
 */

const pct = (v: number, of: number) => Math.round((v / of) * 100000) / 1000

/** When each label pops: right after the detail pass of the object it names (--i in the drawing). */
const AFTER: Readonly<Record<string, number>> = {
  incoming: 9,
  reader: 10,
  tolerance: 11,
  inRange: 11,
  valve: 12,
  record: 13,
  // the logbook's header and opening line print as soon as its card is inked (--i 5)
  logbook: 5,
}
const popAt = (k: string) =>
  k === 'approved' ? VALVE.approvedAt : (AFTER[k] ?? 15) * VALVE.stagger + VALVE.draw + 40

function Tag({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  const w = VALVE_LAYOUT.wide
  const t = VALVE_LAYOUT.tall
  const a = w.tags[k]!
  const b = t.tags[k]!
  const style = {
    '--lx': pct(a[0], w.viewBox[2]),
    '--ly': pct(a[1], w.viewBox[3]),
    '--lw': pct(a[2], w.viewBox[2]),
    '--lxt': pct(b[0], t.viewBox[2]),
    '--lyt': pct(b[1], t.viewBox[3]),
    '--lwt': pct(b[2], t.viewBox[2]),
    '--t': `${popAt(k)}ms`,
  } as CSSProperties
  return (
    <span className={`${s.label} ${className ?? ''}`.trim()} data-label={k} style={style}>
      {children}
    </span>
  )
}

const LOG = ['log.filed', 'log.filed', 'log.filed', 'log.held', 'log.approved'] as const

export function ValveFigure({ className }: { className?: string } = {}) {
  const l = copy.labels
  const src = drawingSrc('valve', 'wide.json')
  const tallSrc = drawingSrc('valve', 'tall.json')
  const labels = (
    <>
      <Tag k="incoming">{l.incoming}</Tag>
      <Tag k="record">{l.record}</Tag>
      <Tag k="reader">
        {l.reader}
        <span className={s.sub}>{l['reader-sub']}</span>
      </Tag>
      <Tag k="tolerance">{l.tolerance}</Tag>
      <Tag k="inRange" className={s.small}>
        {l.inRange}
      </Tag>
      <Tag k="valve">
        {l.valve}
        <span className={s.sub}>{l['valve-sub']}</span>
      </Tag>
      <Tag k="approved" className={s.approved}>
        {l.approved}
      </Tag>
      <Tag k="logbook" className={s.logbook}>
        <span className={s.logTitle}>{l.logbook}</span>
        <ol className={s.log}>
          <li className={s.logOpen} data-line={0} value={0}>
            {copy.ui['log.open']}
          </li>
          {LOG.map((key, i) => (
            <li key={i} className={s.logLine} data-line={i + 1} value={i + 1}>
              {copy.ui[key]}
            </li>
          ))}
        </ol>
      </Tag>
    </>
  )
  return (
    <FigureFrame
      id="valve"
      copy={copy}
      className={`${s.valve} ${className ?? ''}`.trim()}
      layouts={{ wide: VALVE_LAYOUT.wide.viewBox, tall: VALVE_LAYOUT.tall.viewBox }}
      driver="time"
      vars={cssVars(VALVE, 'valve')}
      controls={{ replay: true, playDrawing: true }}
      drawing={
        <LazyDrawing
          src={src}
          tallSrc={tallSrc}
          stillSrc={drawingSrc('valve', 'wide.final.still.svg')}
        />
      }
      still={
        <>
          {(['wide', 'tall'] as const).map((fam) => (
            <img
              key={fam}
              src={drawingSrc('valve', `${fam}.final.still.svg`)}
              alt=""
              loading="lazy"
              className="still-img"
              data-family={fam}
            />
          ))}
        </>
      }
      labels={labels}
    >
      <ValveController src={src} tallSrc={tallSrc} />
    </FigureFrame>
  )
}
