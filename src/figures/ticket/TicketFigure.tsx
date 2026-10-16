import type { CSSProperties, ReactNode } from 'react'
import { ticketFigure as copy } from '@/content/figures/ticket'
import { RichText } from '@/components/ui/RichText'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { drawingSrc } from '@/drawings/files'
import { counts, modeCounts } from '@/drawings/lib/counts'
import { nodeRect } from '@/drawings/lib/route'
import type { LayoutId } from '@/drawings/types'
import { TICKET_REVS, ticketGraph, type TicketRev } from '@/drawings/graphs/ticket'
import { TICKET_EXTRAS, TICKET_VIEW, ticketGeometry } from '@/drawings/views/ticket'
import { TICKET } from '@/motion/timing/ticket'
import { cssVars } from '@/motion/timing-css'
import { labelRoom } from './glyphs'
import { TicketController } from './TicketController.client'
import s from './ticket.module.css'

/**
 * DETAIL 1 / P-00: one supplier delivery ticket, revised from REV 0 to REV 4
 * as the steps P-01 to P-05 scroll by (the frozen step driver sets data-rev
 * when a step crosses 55% of the viewport). Layers load lazily; CSS shows the
 * groups, labels and stills of the current revision. Labels are an HTML
 * overlay, positioned in percent of the box, and wrap inside their tag.
 */

type Tone = 'ink' | 'new' | 'red' | 'hand' | 'doc' | 'stamp'
type Box = readonly [x: number, y: number, w: number]
interface Tag {
  key: string
  text: ReactNode
  tone: Tone
  revs: readonly TicketRev[]
  at: Partial<Record<LayoutId, Box>>
}

const OLD: readonly TicketRev[] = ['rev0', 'rev1']
const NEW: readonly TicketRev[] = ['rev1', 'rev2', 'rev3', 'rev4']
const pct = (v: number, of: number) => Math.round((v / of) * 100000) / 1000
const FAMILIES: readonly LayoutId[] = ['wide', 'tall']

/** Hand-offs and retypes in a revision, from the graph (never literals). */
function tally(rev: TicketRev) {
  return { h: counts(ticketGraph, rev).handoffs, r: modeCounts(ticketGraph, rev).retype }
}

function tags(): Tag[] {
  const out: Tag[] = []
  const geo = { wide: ticketGeometry('wide'), tall: ticketGeometry('tall') }
  const ex = TICKET_EXTRAS
  const both = (f: (fam: LayoutId) => Box | undefined) => {
    const at: Partial<Record<LayoutId, Box>> = {}
    for (const fam of FAMILIES) {
      const b = f(fam)
      if (b) at[fam] = b
    }
    return at
  }
  const tag = (fam: LayoutId, k: string): Box | undefined => {
    const t = ex[fam].tags[k]
    return t ? [t[0], t[1], t[2]] : undefined
  }

  // node labels sit inside their boxes
  for (const n of ticketGraph.nodes) {
    const tone: Tone = n.revs?.includes('rev2') ? 'new' : 'ink'
    out.push({
      key: n.id,
      text: copy.labels[n.label],
      tone,
      revs: n.revs ?? TICKET_REVS,
      at: both((fam) => {
        const node = geo[fam].graph.nodes.find((x) => x.id === n.id)
        if (!node) return undefined
        const r = nodeRect(node, fam)
        const pad = fam === 'wide' ? 10 : 7
        return [r.x + pad, r.y + pad, labelRoom(n.id, r, fam)]
      }),
    })
  }
  // what each hand-off carries (wide only; the tall drawing has no room)
  for (const r of ticketGraph.routes)
    if (r.carries && r.revs?.includes('rev0'))
      out.push({
        key: r.id,
        text: copy.labels[r.carries],
        tone: 'ink',
        revs: ['rev0'],
        at: { wide: tag('wide', r.carries) },
      })
  const add = (key: string, text: ReactNode, tone: Tone, revs: readonly TicketRev[]) =>
    out.push({ key, text, tone, revs, at: both((fam) => tag(fam, key)) })
  add('ai', copy.labels['route.ai'], 'new', NEW)
  add('tolerance', copy.labels['route.tolerance'], 'new', NEW)
  add('signOff', copy.labels['route.signOff'], 'new', NEW)
  add('markup', copy.labels.markup, 'red', ['rev1'])
  add('test', copy.labels.test, 'new', ['rev2'])
  add('parallel', copy.labels.parallel, 'new', ['rev2'])
  add('monitor', copy.labels.monitor, 'new', ['rev4'])
  add('fixed', copy.labels.fixed, 'new', ['rev4'])
  add('photoNote', copy.notes.photo, 'hand', ['rev0'])
  add('poNote', copy.notes.po, 'hand', ['rev0'])
  const t0 = tally('rev0')
  const t2 = tally('rev2')
  add('tape', <RichText value={copy.ui.tape} vars={t0} as="span" />, 'ink', OLD)
  out.push({
    key: 'tapeOne',
    text: <RichText value={copy.ui.tapeOne} vars={t2} as="span" />,
    tone: 'ink',
    revs: ['rev2', 'rev3', 'rev4'],
    at: both((fam) => tag(fam, 'tape')),
  })
  out.push({
    key: 'punch',
    text: (
      <>
        <span>{copy.ui.punchTitle}</span>
        {(['punch.guide', 'punch.walkthrough', 'punch.approvers'] as const).map((k, i) => (
          <span key={k} className={s.tick} style={{ '--i': i } as CSSProperties}>
            {copy.ui[k]}
          </span>
        ))}
      </>
    ),
    tone: 'doc',
    revs: ['rev3', 'rev4'],
    at: both((fam) => tag(fam, 'punch')),
  })
  // the status stamp on the ticket: one per revision, it lands as the step arrives (wide only)
  const tk = geo.wide.graph.nodes.find((x) => x.id === 'ticket')!
  const tr = nodeRect(tk, 'wide')
  for (const rev of TICKET_REVS)
    out.push({
      key: `stamp.${rev}`,
      text: copy.ui[`stamp.${rev}`],
      tone: 'stamp',
      revs: [rev],
      at: { wide: [tr.x + 12, tr.y + 126, tr.w * 0.48] },
    })
  // the hand-over documents carry their names
  for (const fam of FAMILIES)
    ex[fam].docs.forEach(([key, [x, y, w]], i) => {
      const found = out.find((o) => o.key === `doc${i}`)
      const box: Box = [x + 8, y + 18, w - 24]
      if (found) found.at[fam] = box
      else
        out.push({
          key: `doc${i}`,
          text: copy.labels[key],
          tone: 'doc',
          revs: ['rev3', 'rev4'],
          at: { [fam]: box },
        })
    })
  return out
}

function Labels() {
  const [, , ww, wh] = TICKET_VIEW.viewBox!.wide
  const [, , tw, th] = TICKET_VIEW.viewBox!.tall
  return (
    <>
      {tags().map((t) => {
        const w = t.at.wide
        const tl = t.at.tall
        const style = {
          ...(w ? { '--lx': pct(w[0], ww), '--ly': pct(w[1], wh), '--lw': pct(w[2], ww) } : {}),
          ...(tl
            ? { '--lxt': pct(tl[0], tw), '--lyt': pct(tl[1], th), '--lwt': pct(tl[2], tw) }
            : {}),
        } as CSSProperties
        const fam = w && tl ? undefined : w ? 'wide' : 'tall'
        return (
          <span
            key={t.key}
            className={`${s.label} ${t.tone === 'hand' ? 'hand' : ''}`.trim()}
            data-label={t.key}
            data-tone={t.tone}
            data-revs={t.revs.join(' ')}
            {...(fam ? { 'data-fam': fam } : {})}
            style={style}
          >
            {t.text}
          </span>
        )
      })}
    </>
  )
}

export function TicketFigure({ className }: { className?: string } = {}) {
  const stills = FAMILIES.flatMap((fam) =>
    TICKET_REVS.map((rev) => (
      <img
        key={`${fam}.${rev}`}
        src={drawingSrc('ticket', `${fam}.${rev}.still.svg`)}
        alt=""
        loading="lazy"
        className="still-img"
        data-family={fam}
        data-rev={rev}
      />
    )),
  )
  return (
    <FigureFrame
      id="ticket"
      copy={copy}
      className={`${s.ticket} ${className ?? ''}`.trim()}
      layouts={{ wide: TICKET_VIEW.viewBox!.wide, tall: TICKET_VIEW.viewBox!.tall }}
      driver="steps"
      initialRev="rev0"
      vars={cssVars(TICKET, 'ticket')}
      textVars={tally('rev0')}
      drawing={
        <LazyDrawing
          src={drawingSrc('ticket', 'wide.json')}
          tallSrc={drawingSrc('ticket', 'tall.json')}
          stillSrc={drawingSrc('ticket', 'wide.rev0.still.svg')}
        />
      }
      still={<>{stills}</>}
      labels={<Labels />}
    >
      <TicketController revs={copy.revs} />
    </FigureFrame>
  )
}
