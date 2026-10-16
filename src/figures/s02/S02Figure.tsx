import type { CSSProperties } from 'react'
import { s02Figure as copy } from '@/content/figures/s02'
import { RichText } from '@/components/ui/RichText'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { drawingSrc } from '@/drawings/files'
import type { LayoutId, Pt } from '@/drawings/types'
import { S02 } from '@/motion/timing/s02'
import {
  S02_DESTS,
  S02_LABEL,
  S02_LAYOUT,
  S02_TOOLS,
  s02Flanges,
  s02LabelBand,
  type S02Tool,
} from '@/drawings/views/s02'
import { s02Lens, s02PrintAnchors } from './drawing.server'
import { S02Controller, type S02Geo } from './S02Controller.client'
import s from './S02Figure.module.css'

/**
 * S-02 System Integration (owner: scenes-a). Pencil boxes become conduits; one NEW LEAD
 * fans out to three places; on loop 3 a sync fails and an alert goes out. Hybrid: the
 * 2D phases end at S02.handoffP, where the WebGL scene (src/scenes/s02.ts) takes over on
 * desktop scrub; everywhere else the SVG plan mechanism runs three loops and the figure
 * ends on the iso print. Labels are HTML (aria-hidden); the long description carries
 * the meaning.
 */

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
const fam = (f: LayoutId) => S02_LAYOUT[f]

/** Label position vars for a point or a rect, in both families. */
function at(wide: Pt, tall: Pt, size?: { wide: Pt; tall: Pt }): CSSProperties {
  const [, , ww, wh] = fam('wide').viewBox
  const [, , tw, th] = fam('tall').viewBox
  return {
    '--lx': pct(wide[0], ww),
    '--ly': pct(wide[1], wh),
    '--lxt': pct(tall[0], tw),
    '--lyt': pct(tall[1], th),
    ...(size
      ? {
          '--lw': pct(size.wide[0], ww),
          '--lh': pct(size.wide[1], wh),
          '--lwt': pct(size.tall[0], tw),
          '--lht': pct(size.tall[1], th),
        }
      : {}),
  } as CSSProperties
}

/** A tool's label: the band across its box's top (the glyph has the room below). */
const box = (t: S02Tool) => {
  const [wx, wy, ww] = fam('wide').boxes[t]
  const [tx, ty, tw] = fam('tall').boxes[t]
  return at([wx, wy], [tx, ty], {
    wide: [ww, s02LabelBand(fam('wide'), t)],
    tall: [tw, s02LabelBand(fam('tall'), t)],
  })
}

const flangeAt = (f: LayoutId, k: 'pm' | 'acct'): Pt => {
  const [x, y] = s02Flanges(fam(f))[k].at
  return [x - fam(f).flangeIn, y]
}

/** The legend's corner: bottom left, under the CRM, clear of every conduit (plan and iso). */
const LEGEND = { wide: [40, 690] as Pt, tall: [12, 12] as Pt }

/** Tall: the fail chip sits left of the junction's riser, just above the accounting pipe. */
const FAIL_TALL: Pt = [12, fam('tall').routes.acct[2]![1] - 12]

/** Timing vars for the CSS windows (unitless; cssVars would suffix ms). */
const VARS = {
  '--s02-handoff-p': S02.handoffP,
  '--s02-sketch-a': S02.sketchA,
  '--s02-sketch-b': S02.sketchB,
  '--s02-carry-a': S02.carryA,
  '--s02-carry-b': S02.carryB,
  '--s02-scan-a': S02.scanA,
  '--s02-scan-b': S02.scanB,
  '--s02-conduit-a': S02.conduitA,
  '--s02-conduit-b': S02.conduitB,
  '--s02-flange-a': S02.flangeA,
  '--s02-flange-b': S02.flangeB,
  '--s02-sketch-step': S02.sketchStep,
  '--s02-sketch-stroke': S02.sketchStroke,
  '--s02-carry-line-a': S02.carryLineA,
  '--s02-carry-line-b': S02.carryLineB,
  '--s02-sketch-glyph': S02.sketchGlyph,
  '--s02-glyph-stroke': S02.glyphStroke,
  '--s02-ghost-out-b': S02.ghostOutB,
  '--s02-step-a': S02.stepA,
  '--s02-step-b': S02.stepB,
  '--s02-print-ms': `${S02.printMs}ms`,
} as const

function geo(f: LayoutId): S02Geo {
  const l = fam(f)
  return {
    vb: [l.viewBox[2], l.viewBox[3]],
    lens: s02Lens(f),
    stallBack: l.stallBack,
    lead: [l.routes.lead[0]!, l.routes.lead[l.routes.lead.length - 1]!],
    walk: l.walkTo[0] - l.walkFrom[0],
  }
}

export function S02Figure() {
  const ui = copy.ui
  const places = S02_DESTS.length
  const print = { wide: s02PrintAnchors('wide'), tall: s02PrintAnchors('tall') }
  const labels = (
    <>
      {S02_TOOLS.map((t, i) => (
        <span
          key={t}
          data-anchor={S02_LABEL[t]}
          className={`${s.lbl} pv pop`}
          style={{ ...box(t), '--a': S02.labelA + i * S02.sketchStep } as CSSProperties}
        >
          {copy.labels[S02_LABEL[t] as keyof typeof copy.labels]}
        </span>
      ))}
      {S02_TOOLS.map((t) => (
        <span key={`p-${t}`} className={s.prt} style={at(print.wide[t], print.tall[t])}>
          {copy.labels[S02_LABEL[t] as keyof typeof copy.labels]}
        </span>
      ))}
      <span
        data-anchor="lead"
        className={s.tag}
        style={at(fam('wide').routes.lead[0]!, fam('tall').routes.lead[0]!)}
      >
        {ui.lead}
      </span>
      <span
        data-anchor="flange.acct"
        className={s.fail}
        style={at(flangeAt('wide', 'acct'), FAIL_TALL)}
      >
        {ui.failed}
      </span>
      <span className={s.legend} style={at(LEGEND.wide, LEGEND.tall)}>
        <span className={s.key}>
          <RichText value={ui.api} as="span" />
        </span>
        <span className={s.note}>
          <RichText value={ui.arrives} vars={{ places }} as="span" />
        </span>
      </span>
    </>
  )
  return (
    <FigureFrame
      id="s02"
      copy={copy}
      className={s.s02}
      layouts={{ wide: fam('wide').viewBox, tall: fam('tall').viewBox }}
      driver="scroll"
      stage={{ scene: 's02', load: 'near', mode: 'scrub' }}
      vars={VARS}
      textVars={{ places }}
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
          src={drawingSrc('s02', 'wide.json')}
          tallSrc={drawingSrc('s02', 'tall.json')}
          stillSrc={drawingSrc('s02', 'wide.print.still.svg')}
        />
      }
      still={
        <>
          <img
            src={drawingSrc('s02', 'wide.print.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="wide"
          />
          <img
            src={drawingSrc('s02', 'tall.plan.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="tall"
          />
        </>
      }
      labels={labels}
    >
      <S02Controller
        geo={{ wide: geo('wide'), tall: geo('tall') }}
        live={{ done: String(copy.live.done), failed: String(ui.failed) }}
      />
    </FigureFrame>
  )
}
