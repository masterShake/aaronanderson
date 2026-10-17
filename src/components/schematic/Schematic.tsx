import type { CSSProperties, ReactNode } from 'react'
import type { Route } from 'next'
import { IntentLink as Link } from '@/components/ui/IntentLink.client'
import type { FigureId } from '@/content/types'
import type { Graph, LayoutId, Prim, Pt, SymbolId } from '@/drawings/types'
import { counts, modeCounts, routesTouching } from '@/drawings/lib/counts'
import { bounds, primPts } from '@/drawings/lib/geometry'
import {
  center,
  inRev,
  instrumentsOn,
  nodeRect,
  pointAlong,
  routeGraph as routeAny,
} from '@/drawings/lib/route'
import { forFamily } from '@/drawings/views/home'
import { aiPrims, monitorPrims, placeSymbol, tankPrims, valvePrims } from '@/drawings/symbols'
import { tableRows } from '@/drawings/render/table'
import { FigureFrame } from '@/figures/FigureFrame'
import { figureDomId } from '@/figures/types'
import { RichText } from '@/components/ui/RichText'
import { calloutText, ERA_TAG } from './callout'
import type { SchematicCopy } from './copy'
import { lineBoxes, placeAll, type Box } from './place'
import {
  SchematicController,
  type SchematicLines,
  type SchematicObstacles,
} from './SchematicController.client'
import s from './schematic.module.css'

/**
 * The interactive one-line schematic (Home B, pages-drawings §3): tool buttons
 * over the drawing, an As found / Rewired toggle, computed callouts, a table
 * alternative and counts from the graph. The drawing itself is passed in
 * (<LazyDrawing> on pages; the /kit/fig harness may inline it) together with
 * both states' stills. Works without JS: the stills, labels, buttons and the
 * table are all server-rendered.
 *
 * Labels and detail bubbles are placed clear of every box, instrument, person
 * and each other: here in viewBox units with estimated text sizes (no-JS and
 * first paint), then again by the controller with measured sizes at the
 * figure's real width (src/components/schematic/place.ts).
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
  /** Label key of the place a person stands once rewired (ESTIMATING, ON SITE). */
  places?: Readonly<Record<string, string>>
  /** Label keys of the route instruments (their sub-lines are `{key}-sub`). */
  symbolKeys?: { ai: string; valve: string }
  /** Detail bubbles (Rewired only): links to the service sheets, anchored on graph elements. */
  details?: readonly DetailBubble[]
  initial?: State
  /** Width of each tool's nameplate cell (its glyph) per family, in viewBox units: names keep clear of it. */
  plate?: Readonly<Record<LayoutId, number>>
  /** People the tall family's drawing leaves out once rewired (their place labels go too). */
  omitTall?: readonly string[]
  /** The people's scale in the drawing (placeSymbol k), when it is not the kit's default. */
  personK?: number
}

export interface DetailBubble {
  /** Sheet number, e.g. 'S-02' (shown under n). */
  sheet: string
  n: number
  href: Route
  /** Accessible name, e.g. 'Detail 2 on sheet S-02: System Integration'. */
  label: string
  /** A node, route or person id, or 'drawing' for the whole drawing. */
  anchor: string
}

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
const r1 = (v: number) => Math.round(v * 10) / 10

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
 * CSS px per viewBox unit the server assumes for its first placement (the
 * figure at about 1100 px wide, and at a 390 px phone), and the label metrics
 * in px (mono 11 px, uppercase, 0.02em tracking; see schematic.module.css).
 */
const REF_SCALE: Readonly<Record<LayoutId, number>> = { wide: 1.1, tall: 0.88 }
const CHAR_PX = 7
const LINE_PX = 16
const BUBBLE_PX = 32
const PAD_PX = 3

const primsBox = (prims: readonly Prim[]): Box => {
  const [x, y, w, h] = bounds(prims.flatMap((p) => primPts(p, 12)))
  return { x, y, w, h }
}

type Pose = { symbol: SymbolId; at: Pt; atTall?: Pt }
const poseOf = (p: NonNullable<AnyGraph['people']>[number], st: string) =>
  (p.poses as Record<string, Pose | undefined>)[st]
const poseAt = (pose: Pose, family: LayoutId): Pt =>
  family === 'tall' && pose.atTall ? pose.atTall : pose.at

/** Routes a graph as its drawing does: with the family's own ports (views/home.ts forFamily). */
const routeGraph: typeof routeAny = (g, rev, family, o) =>
  routeAny(forFamily(g, family), rev, family, o)

/** Everything drawn in one family and state that labels must stay clear of (viewBox units). */
function obstaclesOf(
  g: AnyGraph,
  family: LayoutId,
  st: string,
  omit: readonly string[] = [],
  personK?: number,
): Box[] {
  const out: Box[] = g.nodes.filter((n) => inRev(n, st)).map((n) => nodeRect(n, family))
  for (const r of routeGraph(g, st, family).values()) {
    const ins = instrumentsOn(r)
    if (ins.ai) {
      const a = aiPrims(ins.ai.at)
      out.push(primsBox([...a.body, ...a.ring]))
    }
    if (ins.valve) {
      const v = valvePrims(ins.valve.at)
      out.push(primsBox([...v.body, ...v.wheel]))
    }
  }
  for (const n of g.nodes.filter((x) => inRev(x, st))) {
    const c = center(nodeRect(n, family))
    if (n.kind === 'store') out.push(primsBox(tankPrims(c, 0.6).body))
    if (n.kind === 'monitor') out.push(primsBox(monitorPrims(c)))
  }
  for (const p of g.people ?? []) {
    const pose = poseOf(p, st)
    if (pose && !omit.includes(p.id))
      out.push(
        primsBox(
          placeSymbol(pose.symbol, poseAt(pose, family), { k: personK }).flatMap((q) => q.prims),
        ),
      )
  }
  return out
}

/** The routed lines of one family and state, as flat polylines (labels prefer not to cross them). */
function linesOf(g: AnyGraph, family: LayoutId, st: string): number[][] {
  const bend = st === g.revs[0] ? 0 : 12
  return [...routeGraph(g, st, family, { bend }).values()].map((r) =>
    r.pts.flatMap(([x, y]) => [Math.round(x), Math.round(y)]),
  )
}

/** A label or bubble to place: its anchor and clearance per family, and its estimated size. */
interface Placed {
  key: string
  show: State
  a: Readonly<Record<LayoutId, Pt>>
  gap: Readonly<Record<LayoutId, number>>
  /** Estimated size in px per family: [w, h]. */
  px: Readonly<Record<LayoutId, readonly [number, number]>>
}

const flat = (bs: readonly Box[]) => bs.flatMap((b) => [r1(b.x), r1(b.y), r1(b.w), r1(b.h)])

export function Schematic({
  id,
  graph: g,
  copy: c,
  drawing,
  stills,
  rewiredLabels = {},
  places = {},
  symbolKeys = { ai: 'sym.ai', valve: 'sym.valve' },
  details = [],
  initial = 'asFound',
  plate,
  omitTall = [],
  personK,
}: SchematicProps) {
  // half a person's height above their feet: where a bubble or place label points
  const midPerson = personK === undefined ? 20 : (64 * personK) / 2
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
    <div role="group" aria-label={c.ui('toggleLabel')} className={s.toggle}>
      {[found, wired].map((st) => (
        <button
          key={st}
          type="button"
          className={s.seg}
          data-state-value={st}
          aria-pressed={st === initial}
        >
          {c.ui(st === found ? 'asFoundButton' : 'rewiredButton')}
        </button>
      ))}
    </div>
  )

  // --- what gets placed: detail bubbles first, then instrument and place labels, then notes
  const placed: Placed[] = []
  const textPx = (text: string, wideText = text): Placed['px'] => ({
    wide: [wideText.length * CHAR_PX + 4, LINE_PX],
    tall: [text.length * CHAR_PX + 4, LINE_PX],
  })
  const both = (f: (family: LayoutId) => Pt) => ({ wide: f('wide'), tall: f('tall') })

  const bubbleAnchor = (anchor: string, family: LayoutId): Pt => {
    const [vx, vy] = g.viewBox[family]
    const n = g.nodes.find((x) => x.id === anchor)
    const r = routes[family].get(anchor)
    const person = (g.people ?? []).find((x) => x.id === anchor)
    if (n) return center(nodeRect(n, family))
    if (r) {
      const ins = instrumentsOn(r)
      return ins.ai?.at ?? ins.valve?.at ?? pointAlong(r.pts, 0.5)
    }
    if (person) {
      const pose = poseOf(person, wired)
      if (pose) {
        const at = poseAt(pose, family)
        return [at[0], at[1] - midPerson]
      }
    }
    return [vx, vy]
  }
  for (const d of details)
    placed.push({
      key: `bubble-${d.sheet}`,
      show: wired,
      a: both((f) => bubbleAnchor(d.anchor, f)),
      gap: { wide: 6, tall: 4 },
      px: { wide: [BUBBLE_PX, BUBBLE_PX], tall: [BUBBLE_PX, BUBBLE_PX] },
    })

  // instrument labels (rewired only): plain words first, then the sub-line, then the (N) chip;
  // the sub-line explains a kind once, on its first instrument, never on every copy
  const explained = new Set<string>()
  const subOf = (key: string) => {
    if (explained.has(key)) return undefined
    explained.add(key)
    return c.maybe(`${key}-sub`)
  }
  const subs: Record<string, string | undefined> = {}
  const inst = (key: string, at = key) => {
    if (!(at in subs)) subs[at] = subOf(key)
    const sub = subs[at]
    return (
      <>
        {c.label(key)}
        {sub ? <span className={s.sub}> · {sub}</span> : null} {c.label(ERA_TAG.N)}
      </>
    )
  }
  const instPx = (key: string, at = key) => {
    const short = `${c.label(key)} ${c.label(ERA_TAG.N)}`
    const sub = subs[at]
    return textPx(short, sub ? `${c.label(key)} · ${sub} ${c.label(ERA_TAG.N)}` : short)
  }
  const labelText: Record<string, ReactNode> = {}
  for (const r of routes.wide.values()) {
    const rt = routes.tall.get(r.id)
    if (!rt) continue
    const iw = instrumentsOn(r)
    const it = instrumentsOn(rt)
    if (iw.ai && it.ai) {
      const key = `${r.id}-ai`
      labelText[key] = inst(symbolKeys.ai, key)
      placed.push({
        key,
        show: wired,
        a: { wide: iw.ai.at, tall: it.ai.at },
        gap: { wide: 20, tall: 20 },
        px: instPx(symbolKeys.ai, key),
      })
    }
    if (iw.valve && it.valve) {
      const key = `${r.id}-hv`
      labelText[key] = inst(symbolKeys.valve, key)
      placed.push({
        key,
        show: wired,
        a: { wide: iw.valve.at, tall: it.valve.at },
        gap: { wide: 18, tall: 18 },
        px: instPx(symbolKeys.valve, key),
      })
    }
  }
  for (const n of g.nodes.filter((x) => x.kind !== 'tool' && inRev(x, wired))) {
    const rw = nodeRect(n, 'wide')
    const rt = nodeRect(n, 'tall')
    labelText[n.id] = inst(n.label, n.id)
    placed.push({
      key: n.id,
      show: wired,
      a: { wide: center(rw), tall: center(rt) },
      gap: { wide: Math.max(rw.w, rw.h) / 2 + 4, tall: Math.max(rt.w, rt.h) / 2 + 4 },
      px: instPx(n.label, n.id),
    })
  }
  // where people stand once rewired, when the place has a name
  for (const person of g.people ?? []) {
    const key = places[person.id]
    const pose = poseOf(person, wired)
    if (!key || !pose) continue
    labelText[`${person.id}-place`] = c.label(key)
    placed.push({
      key: `${person.id}-place`,
      show: wired,
      a: both((f) => {
        const at = poseAt(pose, f)
        return [at[0], at[1] - midPerson]
      }),
      gap: { wide: 6 + midPerson / 2, tall: 6 + midPerson / 2 },
      px: textPx(c.label(key)),
    })
  }
  // hand notes come from the figure's notes; a missing one is left out
  const noteRotate: Record<string, number> = {}
  for (const n of g.notes ?? []) {
    const text = c.note(n.key)
    if (!text) continue
    labelText[`note-${n.key}`] = text
    noteRotate[`note-${n.key}`] = n.rotate
    placed.push({
      key: `note-${n.key}`,
      show: found,
      a: { wide: n.at, tall: n.atTall ?? n.at },
      gap: { wide: 2, tall: 2 },
      // the hand face runs wider than mono and is uppercased
      px: { wide: [text.length * 10 + 8, 24], tall: [text.length * 10 + 8, 24] },
    })
  }

  // --- the server's placement, per family and state, in viewBox units
  const obstacles = {} as SchematicObstacles
  const lines = {} as SchematicLines
  const boxes: Record<string, Partial<Record<LayoutId, Box>>> = {}
  for (const family of FAMILIES) {
    const [vx, vy, vw, vh] = g.viewBox[family]
    const k = REF_SCALE[family]
    obstacles[family] = {}
    lines[family] = {}
    for (const st of [found, wired]) {
      const obs = obstaclesOf(
        g,
        family,
        st,
        family === 'tall' && st === wired ? omitTall : [],
        personK,
      )
      obstacles[family][st] = flat(obs)
      lines[family][st] = linesOf(g, family, st)
      const items = placed.filter((x) => x.show === st)
      const out = placeAll(
        items.map((x) => ({
          ax: x.a[family][0],
          ay: x.a[family][1],
          gap: x.gap[family],
          w: x.px[family][0] / k,
          h: x.px[family][1] / k,
        })),
        obs,
        { x: vx, y: vy, w: vw, h: vh },
        { pad: PAD_PX / k, step: 8, rings: 30 },
        lineBoxes(lines[family][st], 2),
      )
      items.forEach((x, i) => {
        boxes[x.key] = { ...boxes[x.key], [family]: out[i] }
      })
    }
  }
  const placeAttrs = (key: string) => {
    const x = placed.find((q) => q.key === key)!
    const w = boxes[key]?.wide ?? { x: 0, y: 0 }
    const t = boxes[key]?.tall ?? w
    return {
      'data-at': [...x.a.wide, ...x.a.tall].map(r1).join(' '),
      'data-gap': [x.gap.wide, x.gap.tall].map(r1).join(' '),
      style: {
        '--lx': pct(w.x, g.viewBox.wide[2]),
        '--ly': pct(w.y, g.viewBox.wide[3]),
        '--lxt': pct(t.x, g.viewBox.tall[2]),
        '--lyt': pct(t.y, g.viewBox.tall[3]),
      } as CSSProperties,
    }
  }

  const labels = placed
    .filter((x) => !x.key.startsWith('bubble-'))
    .map((x) => {
      const a = placeAttrs(x.key)
      const note = x.key.startsWith('note-')
      return (
        <span
          key={x.key}
          className={note ? s.note : s.inst}
          data-show={x.show}
          data-place={x.key}
          data-wide-only={omitTall.some((pid) => x.key === `${pid}-place`) ? '' : undefined}
          data-at={a['data-at']}
          data-gap={a['data-gap']}
          style={note ? { ...a.style, rotate: `${noteRotate[x.key]}deg` } : a.style}
        >
          {labelText[x.key]}
        </span>
      )
    })

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
        {c.ui('toolsLabel')}
      </p>
      <p id={`${p}-kbd`} className="sr-only">
        {c.ui('keyboard')}
      </p>
      <div
        role="group"
        aria-labelledby={`${p}-tools-l`}
        aria-describedby={`${p}-kbd`}
        className={s.tools}
        data-roving=""
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
            style={
              {
                ...rectVars(g, nodeRect(t, 'wide'), nodeRect(t, 'tall')),
                ...(plate
                  ? {
                      '--pr': pct(plate.wide, g.viewBox.wide[2]),
                      '--prt': pct(plate.tall, g.viewBox.tall[2]),
                    }
                  : {}),
              } as CSSProperties
            }
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
                {c.label(ERA_TAG[t.era])}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {tools.flatMap((t) => [describe(t, found), describe(t, wired)])}
      {details.length ? (
        <ul className={s.bubbles} aria-label={c.ui('bubblesLabel')} data-show={wired}>
          {details.map((d) => {
            const a = placeAttrs(`bubble-${d.sheet}`)
            return (
              <li
                key={d.sheet}
                className={s.bubble}
                data-show={wired}
                data-place={`bubble-${d.sheet}`}
                data-at={a['data-at']}
                data-gap={a['data-gap']}
                data-leader={d.anchor === 'drawing' ? 'none' : undefined}
                style={a.style}
              >
                <Link href={d.href} aria-label={d.label} className={s.bubbleLink}>
                  <span aria-hidden="true">{d.n}</span>
                  <span aria-hidden="true">{d.sheet}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
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
            <td>{c.ui(`table.${r.found}`)}</td>
            <td>{r.rewired ? c.ui(`table.${r.rewired}`) : null}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>
            <RichText value={c.rich('table.counts')} vars={textVars} as="span" />
          </td>
        </tr>
      </tfoot>
    </table>
  )

  const still = FAMILIES.flatMap((fam) =>
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
          {/* leader lines, drawn by the controller once it has placed the labels */}
          <svg data-leaders="" className={s.leaders} focusable="false" />
          {labels}
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
          aria-label={c.ui('close')}
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
        viewBox={{
          wide: [g.viewBox.wide[2], g.viewBox.wide[3]],
          tall: [g.viewBox.tall[2], g.viewBox.tall[3]],
        }}
        obstacles={obstacles}
        lines={lines}
      />
    </FigureFrame>
  )
}

/** Centre of a node in a family (for detail bubbles and leaders). */
export const nodeCenter = (g: AnyGraph, nid: string, family: LayoutId): Pt | null => {
  const n = g.nodes.find((x) => x.id === nid)
  return n ? center(nodeRect(n, family)) : null
}
