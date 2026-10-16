import type { CSSProperties } from 'react'
import type { Rich } from '@/content/types'
import { s05Figure as copy } from '@/content/figures/s05'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { ScrubPlay } from '@/figures/s01/ScrubPlay.client'
import { drawingSrc } from '@/drawings/files'
import { cssVars } from '@/motion/timing-css'
import { S05 } from '@/motion/timing/s05'
import {
  S05_CREW,
  S05_GEO,
  S05_VB,
  calloutAlign,
  calloutAt,
  hireLabelAt,
  personLabelAt,
  qLabelAt,
  recordAt,
  type S05Pos,
} from '@/drawings/views/s05'
import s from './s05.module.css'

/**
 * DETAIL 5 / S-05 · THE CREW, TRAINED (pages-drawings §6.5). Paper only, no
 * loop. The crew stays pencil; the handed tools carry the only orange. --p
 * drives every beat (scrubbed on the sheet at 1024 px and up, played over
 * S05.playMs elsewhere); the still is p = 1.
 */

const str = (v: Rich): string => (typeof v === 'string' ? v : v.text)
const pos = (p: S05Pos) => ({
  '--lx': p.wide[0],
  '--ly': p.wide[1],
  '--lxt': p.tall[0],
  '--lyt': p.tall[1],
})
const css = (o: Record<string, string | number>) => o as CSSProperties
const file = (f: string) => drawingSrc('s05', f)

const PEOPLE = ['person.estimator', 'person.pm', 'person.field'] as const
const ROWS = ['row.office', 'row.field', 'row.playbook', 'row.walkthrough'] as const
const SUB = {
  'callout.playbook': 'callout.playbook.sub',
  'callout.guideline': 'callout.guideline.sub',
  'callout.walkthrough': 'callout.walkthrough.sub',
} as const

function Labels() {
  const ui = copy.ui
  return (
    <>
      {S05_CREW.map((c, i) => (
        <span
          key={`p.${c.person}`}
          className={s.person}
          style={css({ ...pos(personLabelAt(i)), '--i': i })}
        >
          {copy.labels[PEOPLE[i]!]}
        </span>
      ))}
      {S05_CREW.map((c, i) => (
        <span key={`q.${c.person}`} className={s.q} style={css({ ...pos(qLabelAt(i)), '--i': i })}>
          {copy.labels.question}
        </span>
      ))}
      {S05_CREW.map((c, i) => (
        <span
          key={`c.${c.person}`}
          className={s.callout}
          data-align={calloutAlign(i)}
          style={css({ ...pos(calloutAt(i)), '--i': i })}
        >
          <span className={s.name}>{copy.labels[c.callout]}</span>
          <span className={s.sub}>{copy.labels[SUB[c.callout]]}</span>
        </span>
      ))}
      <span className={s.hire} style={css(pos(hireLabelAt))}>
        {copy.labels['person.newHire']}
      </span>
      <div
        className={s.record}
        style={css({
          ...pos(recordAt),
          '--rw': S05_GEO.wide.recordW,
          '--rwt': S05_GEO.tall.recordW,
        })}
      >
        <p className={s.recordTitle}>{str(ui.recordTitle)}</p>
        <ol className={s.rows}>
          {ROWS.map((r, i) => (
            <li key={r} style={css({ '--i': i })}>
              <span>{str(ui[r])}</span>
              <span className={s.done}>{str(ui.done)}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

export function S05Figure() {
  return (
    <FigureFrame
      id="s05"
      copy={copy}
      className={s.fig}
      layouts={{ wide: S05_VB.wide, tall: S05_VB.tall }}
      driver="scroll"
      vars={cssVars(S05, 's05')}
      controls={{ replay: true }}
      drawing={
        <LazyDrawing
          src={file('wide.json')}
          tallSrc={file('tall.json')}
          stillSrc={file('wide.trained.still.svg')}
        />
      }
      labels={<Labels />}
      still={
        <>
          <img
            src={file('wide.trained.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="wide"
          />
          <img
            src={file('tall.trained.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="tall"
          />
        </>
      }
    >
      <ScrubPlay id="s05" playMs={S05.playMs} />
    </FigureFrame>
  )
}
