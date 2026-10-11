import type { CSSProperties, ReactNode } from 'react'
import type { FigureId } from '@/content/types'
import type { Graph, LayoutId, Pt } from '@/drawings/types'
import { counts, modeCounts, routesTouching } from '@/drawings/lib/counts'
import { center, inRev, instrumentsOn, nodeRect, routeGraph } from '@/drawings/lib/route'
import { tableRows } from '@/drawings/render/table'
import { FigureFrame } from '@/figures/FigureFrame'
import { figureDomId } from '@/figures/types'
import { calloutText } from './callout'
import { fill, type SchematicCopy } from './copy'
import { SchematicController } from './SchematicController.client'
import s from './schematic.module.css'

/**
 * The interactive one-line schematic (Home B, pages-drawings §3): tool buttons
 * over the drawing, an As found / Rewired toggle, computed callouts, a table
 * alternative and counts from the graph. The drawing itself is passed in
 * (<LazyDrawing> on pages; the /kit/fig harness may inline it) together with
 * both states' stills. Works without JS: the stills, labels, buttons and the
 * table are all server-rendered.
 */

type AnyGraph = Graph<string, string>
type State = 'asFound' | 'rewired'

export interface SchematicProps {
  id: FigureId
  graph: AnyGraph
  copy: SchematicCopy
  /** The live layers: <LazyDrawing> or <InlineDrawing>. */
  drawing: ReactNode
  /** Still image URLs per family and state. */
  stills: Readonly<Record<LayoutId, Readonly<Record<State, string>>>>
  /** Label key a tool shows once rewired, when it differs (Estimate_FINAL_v7.xlsx → Estimating). */
  rewiredLabels?: Readonly<Record<string, string>>
  initial?: State
}

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

/** Position vars for an element covering a rect, in both families. */
function rectVars(g: AnyGraph, rw: { x: number; y: number; w: number; h: number }, rt: typeof rw) {
  const [, , ww, wh] = g.viewBox.wide
  const [, , tw, th] = g.viewBox.tall
  return {
    '--lx': pct(rw.x, ww),
    '--ly': pct(rw.y, wh),
    '--lw': pct(rw.w, ww),
    '--lh': pct(rw.h, wh),
    '--lxt': pct(rt.x, tw),
    '--lyt': pct(rt.y, th),
    '--lwt': pct(rt.w, tw),
    '--lht': pct(rt.h, th),
  } as CSSProperties
}

/**
 * The top-left of a label next to a symbol at p: the first of eight spots
 * around it (radius r) whose label box (about 150 × 18 u wide, 120 × 18 tall)
 * stays inside the viewBox and clear of every box.
 */
function freeSpot(g: AnyGraph, family: LayoutId, p: Pt, r: number): Pt {
  const [vx, vy, vw, vh] = g.viewBox[family]
  const [w, h] = family === 'wide' ? [150, 18] : [120, 18]
  const rects = g.nodes
    .filter((n) => inRev(n, g.revs[g.revs.length - 1]!))
    .map((n) => nodeRect(n, family))
  const spots: Pt[] = [
    [p[0] + r, p[1] - r - h],
    [p[0] + r, p[1] + r],
    [p[0] - r - w, p[1] - r - h],
    [p[0] - r - w, p[1] + r],
    [p[0] - w / 2, p[1] - r - h],
    [p[0] - w / 2, p[1] + r],
    [p[0] + r, p[1] - h / 2],
    [p[0] - r - w, p[1] - h / 2],
  ]
  const free = spots.find(
    ([x, y]) =>
      x >= vx &&
      y >= vy &&
      x + w <= vx + vw &&
      y + h <= vy + vh &&
      !rects.some((q) => x < q.x + q.w && x + w > q.x && y < q.y + q.h && y + h > q.y),
  )
  return free ?? spots[0]!
}

const pointVars = (g: AnyGraph, w: Pt, t: Pt) =>
  ({
    '--lx': pct(w[0], g.viewBox.wide[2]),
    '--ly': pct(w[1], g.viewBox.wide[3]),
    '--lxt': pct(t[0], g.viewBox.tall[2]),
    '--lyt': pct(t[1], g.viewBox.tall[3]),
  }) as CSSProperties

export function Schematic({
  id,
  graph: g,
  copy: c,
  drawing,
  stills,
  rewiredLabels = {},
  initial = 'asFound',
}: SchematicProps) {
  const dom = figureDomId(id)
  const p = `${id}-sch`
  const [found, wired] = [g.revs[0]!, g.revs[1] ?? g.revs[0]!] as [State, State]
  const tools = g.nodes
    .filter((n) => n.kind === 'tool')
    .sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0])
  const routes = { wide: routeGraph(g, wired, 'wide'), tall: routeGraph(g, wired, 'tall') }

  // what each tool touches, per state: its own box, its routes, their instruments
  const touch: Record<string, Record<string, string[]>> = {}
  for (const st of [found, wired]) {
    touch[st] = {}
    for (const t of tools) {
      const rs = routesTouching(g, st, t.id).map((r) => r.id)
      touch[st]![t.id] = [t.id, ...rs, ...rs.flatMap((r) => [`${r}.ai`, `${r}.hv`])]
    }
  }

  const fc = counts(g, found)
  const mc = modeCounts(g, found)
  const textVars = { tools: fc.tools, handoffs: fc.handoffs, byHand: fc.manual, retyped: mc.retype }
  const revs = (c.figure.revs ?? {}) as Readonly<Record<string, string>>

  const toggle = (
    <div role="group" aria-label={c.ui('state.group')} className={s.toggle}>
      {[found, wired].map((st) => (
        <button
          key={st}
          type="button"
          className={s.seg}
          data-state-value={st}
          aria-pressed={st === initial}
        >
          {c.ui(st === found ? 'state.asFound' : 'state.rewired')}
        </button>
      ))}
    </div>
  )

  // instrument labels (rewired only), placed from the routed geometry
  const instLabels: ReactNode[] = []
  for (const r of routes.wide.values()) {
    const rt = routes.tall.get(r.id)
    if (!rt) continue
    const iw = instrumentsOn(r)
    const it = instrumentsOn(rt)
    if (iw.ai && it.ai)
      instLabels.push(
        <span
          key={`${r.id}-ai`}
          className={s.inst}
          data-show={wired}
          style={pointVars(g, freeSpot(g, 'wide', iw.ai.at, 22), freeSpot(g, 'tall', it.ai.at, 20))}
        >
          {c.label('inst.ai')} {c.ui('era.N')}
        </span>,
      )
    if (iw.valve && it.valve)
      instLabels.push(
        <span
          key={`${r.id}-hv`}
          className={s.inst}
          data-show={wired}
          style={pointVars(
            g,
            freeSpot(g, 'wide', iw.valve.at, 26),
            freeSpot(g, 'tall', it.valve.at, 24),
          )}
        >
          {c.label('inst.hv')} {c.ui('era.N')}
        </span>,
      )
  }
  for (const n of g.nodes.filter((x) => x.kind !== 'tool' && inRev(x, wired))) {
    const rw = nodeRect(n, 'wide')
    const rt = nodeRect(n, 'tall')
    instLabels.push(
      <span
        key={n.id}
        className={s.inst}
        data-show={wired}
        style={pointVars(
          g,
          freeSpot(g, 'wide', center(rw), rw.h / 2 + 4),
          freeSpot(g, 'tall', center(rt), rt.h / 2 + 4),
        )}
      >
        {c.label(n.label)} {c.ui('era.N')}
      </span>,
    )
  }
  const notes = (g.notes ?? []).map((n) => (
    <span
      key={n.key}
      className={s.note}
      data-show={n.key === 'note.plumbing' ? wired : found}
      style={{ ...pointVars(g, n.at, n.atTall ?? n.at), rotate: `${n.rotate}deg` }}
    >
      {c.label(n.key)}
    </span>
  ))

  const describe = (t: (typeof tools)[number], st: State) => {
    const text = calloutText(g, t.id, st, c, st === wired ? rewiredLabels[t.id] : undefined)
    return (
      <span key={`${t.id}-${st}`} id={`${p}-d-${t.id}-${st}`} className="sr-only">
        <span data-title="">{text.title}</span> <span data-body="">{text.body}</span>
      </span>
    )
  }

  const ui = (
    <>
      <p id={`${p}-tools-l`} className="sr-only">
        {c.ui('tools.group')}
      </p>
      <p id={`${p}-kbd`} className="sr-only">
        {c.ui('tools.keyboard')}
      </p>
      <div
        role="group"
        aria-labelledby={`${p}-tools-l`}
        aria-describedby={`${p}-kbd`}
        className={s.tools}
      >
        {tools.map((t, i) => (
          <button
            key={t.id}
            id={`${p}-tool-${t.id}`}
            type="button"
            className={s.tool}
            data-tool={t.id}
            tabIndex={i === 0 ? 0 : -1}
            aria-expanded={false}
            aria-controls={`${p}-callout`}
            aria-describedby={`${p}-d-${t.id}-${initial}`}
            style={rectVars(g, nodeRect(t, 'wide'), nodeRect(t, 'tall'))}
          >
            <span className={s.name} data-show={rewiredLabels[t.id] ? found : undefined}>
              {c.label(t.label)}
            </span>
            {rewiredLabels[t.id] ? (
              <span className={s.name} data-show={wired}>
                {c.label(rewiredLabels[t.id]!)}
              </span>
            ) : null}
            {t.era ? (
              <span className={s.era} data-show={wired} aria-hidden="true">
                {c.ui(`era.${t.era}`)}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {tools.flatMap((t) => [describe(t, found), describe(t, wired)])}
    </>
  )

  const rows = tableRows(g, found, wired)
  const nodeLabel = (nid: string) => {
    const n = g.nodes.find((x) => x.id === nid)
    return n ? c.label(n.label) : nid
  }
  const table = (
    <table className={s.table}>
      <caption>{c.figure.table?.caption}</caption>
      <thead>
        <tr>
          {(c.figure.table?.columns ?? []).map((col) => (
            <th key={col} scope="col">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{nodeLabel(r.from)}</td>
            <td>{nodeLabel(r.to)}</td>
            <td>{r.carries ? c.label(r.carries) : null}</td>
            <td>{c.ui(`found.${r.found}`)}</td>
            <td>{r.rewired ? c.ui(`rewired.${r.rewired}`) : null}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>{fill(c.ui('table.total'), textVars)}</td>
        </tr>
      </tfoot>
    </table>
  )

  const still = (['wide', 'tall'] as const).flatMap((fam) =>
    [found, wired].map((st) => (
      // static SVG stills from /drawings/[file]; next/image would add nothing
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${fam}-${st}`}
        src={stills[fam][st]}
        alt=""
        loading="lazy"
        className={`still-img ${s.still}`}
        data-family={fam}
        data-show={st}
      />
    )),
  )

  return (
    <FigureFrame
      id={id}
      copy={c.figure}
      layouts={{ wide: g.viewBox.wide, tall: g.viewBox.tall }}
      driver="input"
      initialRev={initial}
      initialToggle={initial}
      className={s.schematic}
      drawing={drawing}
      still={still}
      labels={
        <>
          {instLabels}
          {notes}
        </>
      }
      ui={ui}
      table={table}
      controls={{ extra: toggle }}
      textVars={textVars}
    >
      <div id={`${p}-callout`} className={s.callout} hidden>
        <div aria-hidden="true">
          <p className={s.calloutTitle} data-callout-title="" />
          <p className={s.calloutBody} data-callout-body="" />
        </div>
        <button
          type="button"
          className={s.close}
          data-callout-close=""
          aria-label={c.ui('callout.close')}
          hidden
        >
          ×
        </button>
      </div>
      <SchematicController
        figure={dom}
        prefix={p}
        tools={tools.map((t) => t.id)}
        touch={touch}
        chips={Object.fromEntries([found, wired].map((st) => [st, revs[st] ?? st]))}
        initial={initial}
      />
    </FigureFrame>
  )
}

/** Centre of a node in a family (for detail bubbles and leaders). */
export const nodeCenter = (g: AnyGraph, nid: string, family: LayoutId): Pt | null => {
  const n = g.nodes.find((x) => x.id === nid)
  return n ? center(nodeRect(n, family)) : null
}
