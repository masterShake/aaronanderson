import type { DrawingBuilder, DrawingBundle, Graph, Pt, SvgDoc, ViewBox } from '../types'

/**
 * A three-node graph and a minimal CAD render of it, so /drawings/[file]
 * prerenders on day 0 and the figure contract tests have a real file to load.
 * The drawings lane's renderers replace this render; the fixture stays as a
 * test input. No roughjs here: clean lines only.
 */

export const fixtureGraph: Graph<'tool.a' | 'tool.b' | 'tool.c', 'asFound'> = {
  id: '_fixture',
  viewBox: { wide: [0, 0, 960, 640], tall: [0, 0, 400, 480] },
  designWidth: { wide: 960, tall: 400 },
  revs: ['asFound'],
  nodes: [
    {
      id: 'a',
      kind: 'tool',
      label: 'tool.a',
      at: [120, 280],
      atTall: [40, 60],
      size: [160, 80],
      ports: { e: { side: 'e', at: 0.5 } },
    },
    {
      id: 'b',
      kind: 'tool',
      label: 'tool.b',
      at: [400, 280],
      atTall: [120, 200],
      size: [160, 80],
      ports: { w: { side: 'w', at: 0.5 }, e: { side: 'e', at: 0.5 } },
    },
    {
      id: 'c',
      kind: 'tool',
      label: 'tool.c',
      at: [680, 280],
      atTall: [200, 340],
      size: [160, 80],
      ports: { w: { side: 'w', at: 0.5 } },
    },
  ],
  routes: [
    { id: 'ab', from: 'a.e', to: 'b.w', kind: 'conduit', mode: 'sync' },
    { id: 'bc', from: 'b.e', to: 'c.w', kind: 'conduit', mode: 'sync' },
  ],
  seed: 1,
}

type Family = 'wide' | 'tall'

const r = (n: number) => Math.round(n * 100) / 100

function rectPath([x, y]: Pt, [w, h]: readonly [number, number]) {
  return { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, len: 2 * (w + h) }
}

/** The clean CAD doc for one family: boxes and straight conduits. */
export function fixtureDoc(family: Family): SvgDoc {
  const g = fixtureGraph
  const at = (n: (typeof g.nodes)[number]) => (family === 'tall' && n.atTall ? n.atTall : n.at)
  const boxes = g.nodes.map((n, i) => {
    const p = rectPath(at(n), n.size)
    return { el: 'path' as const, d: p.d, len: p.len, part: n.id, i, cls: 's-cad' }
  })
  const lines = g.routes.map((route, i) => {
    const a = g.nodes.find((n) => n.id === route.from.split('.')[0])!
    const b = g.nodes.find((n) => n.id === route.to.split('.')[0])!
    const [ax, ay] = at(a)
    const [bx, by] = at(b)
    const x1 = ax + a.size[0]
    const y1 = ay + a.size[1] / 2
    const x2 = bx
    const y2 = by + b.size[1] / 2
    const len = Math.abs(x2 - x1) + Math.abs(y2 - y1)
    const mx = r((x1 + x2) / 2)
    return {
      el: 'path' as const,
      d: `M${x1} ${y1}H${mx}V${y2}H${x2}`,
      len,
      part: route.id,
      i,
      cls: 's-conduit',
    }
  })
  return {
    viewBox: g.viewBox[family],
    groups: [{ layer: 'cad', children: [...boxes, ...lines] }],
  }
}

const attrs = (vb: ViewBox) => `viewBox="${vb.join(' ')}"`

function nodeMarkup(doc: SvgDoc, baked: boolean): string {
  const stroke = baked ? ' fill="none" stroke="#BFE6F5" stroke-width="2"' : ''
  return doc.groups
    .map(
      (g) =>
        `<g data-layer="${g.layer}"${stroke}>${g.children
          .map((c) =>
            c.el === 'path'
              ? `<path d="${c.d}" pathLength="1" class="${c.cls}" data-part="${c.part}" style="--i:${c.i};--len:${c.len}"/>`
              : '',
          )
          .join('')}</g>`,
    )
    .join('')
}

/** A self-contained still: panel color and strokes baked in, no text. */
export function fixtureStill(family: Family): string {
  const doc = fixtureDoc(family)
  const [, , w, h] = doc.viewBox
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs(doc.viewBox)} width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#143A6B"/>${nodeMarkup(doc, true)}</svg>`
}

/** The layer bundle LazyDrawing injects. */
export function fixtureBundle(family: Family): DrawingBundle {
  const doc = fixtureDoc(family)
  return { v: 1, vb: [doc.viewBox[2], doc.viewBox[3]], layers: { cad: nodeMarkup(doc, false) } }
}

export const drawing: DrawingBuilder = {
  files: ['wide.json', 'tall.json', 'wide.still.svg', 'tall.still.svg'],
  build(file) {
    const family: Family = file.startsWith('tall') ? 'tall' : 'wide'
    return file.endsWith('.json') ? JSON.stringify(fixtureBundle(family)) : fixtureStill(family)
  },
}
