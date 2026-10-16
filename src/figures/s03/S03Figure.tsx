import type { CSSProperties } from 'react'
import { s03Figure as copy } from '@/content/figures/s03'
import { site } from '@/content/site'
import type { Rich } from '@/content/types'
import { drawingSrc } from '@/drawings/files'
import { S03_BATCH, S03_COUNTS, S03_LABELS, pct, type S03LabelKey } from '@/drawings/views/s03'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import frame from '@/figures/FigureFrame.module.css'
import { cssVars } from '@/motion/timing-css'
import { S03 } from '@/motion/timing/s03'
import { DIAL, G, S03_FAMILY, TRAVEL } from '@/scenes/s03/section'
import { S03Controller } from './S03Controller.client'
import s from './S03.module.css'

/**
 * S-03 AI Workflow Automation, DETAIL 3 (owner: scenes-b). A pencil machine
 * becomes section A–A on blueprint; documents go in, labeled data cards come
 * out, and the third document, below tolerance, drops to the sign-off tray.
 * The batch waits at HELD FOR APPROVAL until the visitor presses Approve.
 * Desktop scrubs and hands off to WebGL at the front elevation; elsewhere the
 * 2D phases play on entry. The still and svg tiers swap the held and approved stills.
 */

/** Timing vars plus the dial and gate angles (geometry, from section.ts). */
const VARS = {
  ...cssVars(S03, 's03'),
  '--s03-uw': S03_FAMILY.wide.s,
  '--s03-ut': S03_FAMILY.tall.s,
  '--s03-ok-deg': `${DIAL.okDeg}deg`,
  '--s03-check-deg': `${DIAL.checkDeg}deg`,
  '--s03-gate-deg': `${G.gate.deg}deg`,
  '--s03-at-drop': TRAVEL.drop,
  '--s03-at-read': TRAVEL.read,
  '--s03-at-gate': TRAVEL.gate,
  '--s03-at-out': TRAVEL.out,
  '--s03-at-held-x': TRAVEL.heldX,
  '--s03-at-held-y': TRAVEL.heldY,
  '--s03-at-card': TRAVEL.card,
  '--s03-at-stamp': TRAVEL.stamp,
} as const
const WIDE = S03_FAMILY.wide.vb
const TALL = S03_FAMILY.tall.vb
const BARS = ['card.vendor', 'card.job', 'card.amount', 'card.date'] as const
const BAR_W = ['72%', '46%', '60%', '34%']

/** Fills {name} and {name:word} from the demo batch counts (server side, plain text). */
function fill(value: Rich): string {
  const text = typeof value === 'string' ? value : value.text
  return text.replace(/\{([a-zA-Z]+)(?::word)?\}/g, (m, k: string) =>
    k in S03_COUNTS ? String(S03_COUNTS[k as keyof typeof S03_COUNTS]) : m,
  )
}

const plain = (v: Rich | undefined) => (v === undefined ? '' : typeof v === 'string' ? v : v.text)

function at(key: S03LabelKey): CSSProperties {
  const p = S03_LABELS[key]
  return {
    '--lx': pct(p.wide[0], WIDE[2]),
    '--ly': pct(p.wide[1], WIDE[3]),
    '--lxt': pct(p.tall[0], TALL[2]),
    '--lyt': pct(p.tall[1], TALL[3]),
  } as CSSProperties
}

const SUBS: Partial<Record<S03LabelKey, keyof typeof copy.labels>> = {
  reader: 'reader-sub',
  tray: 'tray-sub',
}

const KEYS = ['hopper', 'tolerance', 'reader', 'output', 'tray', 'section'] as const

function Labels() {
  const ui = copy.ui
  return (
    <>
      {KEYS.map((k) => {
        const sub = SUBS[k]
        return (
          <span key={k} data-anchor={k} className={`${s.label} ${s[k] ?? ''}`} style={at(k)}>
            <span className={s.text}>{copy.labels[k]}</span>
            {sub ? <span className={s.sub}>{copy.labels[sub]}</span> : null}
            {k === 'hopper'
              ? S03_BATCH.map((d, i) => (
                  <span key={d.label} data-doc-name={i} className={`${s.sub} ${s.docName}`}>
                    {copy.labels[d.label]}
                  </span>
                ))
              : null}
          </span>
        )
      })}
      <span data-anchor="card" className={`${s.label} ${s.card}`} style={at('card')}>
        <span className={s.cardTag}>{site.sampleTag}</span>
        {BARS.map((b, i) => (
          <span key={b} style={{ display: 'contents' }}>
            <span>{plain(ui[b])}</span>
            <span className={s.bar} style={{ '--w': BAR_W[i] } as CSSProperties} />
          </span>
        ))}
      </span>
    </>
  )
}

export function S03Figure() {
  const ui = copy.ui
  const controls = copy.controls
  return (
    <FigureFrame
      id="s03"
      copy={copy}
      className={s.root}
      layouts={{ wide: WIDE, tall: TALL }}
      driver="scroll"
      stage={{ scene: 's03', load: 'near', mode: 'scrub' }}
      vars={VARS}
      textVars={S03_COUNTS}
      controls={{
        replay: true,
        playDrawing: true,
        motion: true,
        extra: (
          <>
            <span className={s.chip}>
              <span data-when="running">{plain(ui.runningChip)}</span>
              <span data-when="held">{plain(ui.heldChip)}</span>
              <span data-when="approved">{plain(ui.approvedChip)}</span>
            </span>
            <button
              type="button"
              data-action="approve"
              aria-disabled="true"
              aria-describedby="fig-s03-wait"
              className={`${frame.button} ${s.approve}`}
            >
              <span data-when="approve">{controls.approve}</span>
              <span data-when="again">{controls.runAnother}</span>
            </button>
            <span id="fig-s03-wait" className={s.wait}>
              {plain(ui.waiting)}
            </span>
          </>
        ),
      }}
      labels={<Labels />}
      drawing={
        <LazyDrawing
          src={drawingSrc('s03', 'wide.json')}
          tallSrc={drawingSrc('s03', 'tall.json')}
          stillSrc={drawingSrc('s03', 'wide.held.still.svg')}
        />
      }
      still={
        <>
          {(['held', 'approved'] as const).map((st) => (
            <img
              key={`wide-${st}`}
              src={drawingSrc('s03', `wide.${st}.still.svg`)}
              data-still={st}
              data-family="wide"
              alt=""
              loading="lazy"
              className="still-img"
            />
          ))}
          {(['held', 'approved'] as const).map((st) => (
            <img
              key={`tall-${st}`}
              src={drawingSrc('s03', `tall.${st}.still.svg`)}
              data-still={st}
              data-family="tall"
              alt=""
              loading="lazy"
              className="still-img"
            />
          ))}
        </>
      }
    >
      <S03Controller liveHeld={fill(copy.live.held)} liveApproved={fill(copy.live.approved)} />
    </FigureFrame>
  )
}
