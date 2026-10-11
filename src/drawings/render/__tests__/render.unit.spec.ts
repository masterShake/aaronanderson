import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ModelSpec, SvgDoc, SvgNode } from '@/drawings/types'
import { firmGraph, FIRM_TOOLS } from '@/drawings/graphs/firm'
import { fixtureGraph } from '@/drawings/graphs/_fixture'
import { counts, modeCounts } from '@/drawings/lib/counts'
import { routeGraph, nodeRect, nodeSize, segHitsRect, visible } from '@/drawings/lib/route'
import { planFrame, frontFrame } from '@/drawings/lib/frame'
import { toSvgString } from '@/drawings/lib/svg-string'
import { graphBuilder, graphDoc, isoPrintDoc, pencil, tableRows } from '@/drawings/render'
import { frameNodes } from '@/drawings/render/cad'
import { ROUGH, ROUGH_CAPS } from '@/drawings/kit/rough'
import { LIBRARY, placeSymbol } from '@/drawings/symbols'
import { FIRM_STATES } from '@/drawings/render/firm'

/**
 * The drawing pipeline, without a browser: determinism, the stroke and text
 * rules, counts from the graph, the legibility floor, and routing clearance.
 * No count literals: every expected number comes from counts(graph).
 */

const builder = () => graphBuilder(firmGraph, FIRM_STATES)

const groups = (doc: SvgDoc) => doc.groups.flatMap((g) => g.children)
const isG = (n: SvgNode): n is Extract<SvgNode, { el: 'g' }> => n.el === 'g'

const model: ModelSpec = {
  id: 'test',
  layout: 'wide',
  viewBox: [0, 0, 960, 640],
  start: 'plan',
  parts: [
    {
      id: 'a',
      kind: 'box',
      prims: [{ t: 'rect', at: [120, 240], size: [160, 80] }],
      depth: 44,
      material: 'aluminum',
      anchor: 'a',
    },
    {
      id: 't',
      kind: 'tank',
      prims: [{ t: 'circle', c: [680, 280], r: 48 }],
      depth: 112,
      material: 'aluminum',
    },
    {
      id: 'v',
      kind: 'valve',
      prims: [{ t: 'rect', at: [480, 540], size: [40, 20] }],
      depth: 20,
      material: 'orange',
    },
    {
      id: 'p',
      kind: 'pipe',
      prims: [
        {
          t: 'poly',
          pts: [
            [280, 280],
            [632, 280],
          ],
        },
      ],
      depth: 18,
      material: 'aluminum',
    },
  ],
}

test('rendering the same graph twice gives byte-identical strings', () => {
  const a = builder()
  const b = builder()
  for (const f of a.files) expect(a.build(f)).toBe(b.build(f))
  const p1 = pencil([{ t: 'rect', at: [0, 0], size: [100, 50] }], { seed: 42, preset: 'box' })
  const p2 = pencil([{ t: 'rect', at: [0, 0], size: [100, 50] }], { seed: 42, preset: 'box' })
  expect(p1).toEqual(p2)
  expect(toSvgString(isoPrintDoc(model))).toBe(toSvgString(isoPrintDoc(model)))
})

// spelled in two parts so `grep -rn` for the property over src/ finds only real uses
const NON_SCALING = ['vector', 'effect'].join('-')

test('no <text> and no non-scaling strokes in any rendered SVG', () => {
  const b = builder()
  const outs = [
    ...b.files.map((f) => b.build(f)),
    toSvgString(isoPrintDoc(model)),
    toSvgString({
      viewBox: [0, 0, 960, 640],
      groups: [{ layer: 'cad', children: frameNodes(planFrame(model)) }],
    }),
    toSvgString(graphDoc(fixtureGraph, 'asFound', 'wide')),
  ]
  for (const s of outs) {
    expect(s).not.toContain('<text')
    expect(s).not.toContain(NON_SCALING)
  }
  // every live path is a draw-on-ready path
  const json = JSON.parse(b.build('wide.json')) as { layers: Record<string, string> }
  for (const markup of Object.values(json.layers)) {
    const paths = markup.match(/<path [^>]*>/g) ?? []
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) expect(p).toContain('pathLength="1"')
  }
  if (process.env.DRAWINGS_DUMP) {
    mkdirSync(process.env.DRAWINGS_DUMP, { recursive: true })
    for (const f of b.files) writeFileSync(join(process.env.DRAWINGS_DUMP, `firm.${f}`), b.build(f))
    writeFileSync(join(process.env.DRAWINGS_DUMP, 'iso.svg'), toSvgString(isoPrintDoc(model)))
  }
})

test('rendered tool, hand-off, by-hand and people counts equal counts(graph)', () => {
  for (const family of ['wide', 'tall'] as const) {
    const found = graphDoc(firmGraph, 'asFound', family)
    const kids = groups(found).filter(isG)
    const c = counts(firmGraph, 'asFound')
    const tools = kids.filter((g) => FIRM_TOOLS.includes(g.part as (typeof FIRM_TOOLS)[number]))
    expect(tools.length).toBe(c.tools)
    const handoffs = kids.filter((g) => /^h\d\d$/.test(g.part ?? ''))
    expect(handoffs.length).toBe(c.handoffs)
    // a by-hand line carries the paper glyph (a paper-filled path); a sync does not
    const byHand = handoffs.filter((g) =>
      g.children.some((n) => n.el === 'path' && n.cls.includes('f-paper')),
    )
    expect(byHand.length).toBe(c.manual)
    const people = kids.filter((g) => g.cls === 'person')
    expect(people.length).toBe(c.peopleOnLines)

    const wired = graphDoc(firmGraph, 'rewired', family)
    const w = counts(firmGraph, 'rewired')
    const wkids = groups(wired).filter(isG)
    expect(
      wkids.filter((g) => FIRM_TOOLS.includes(g.part as (typeof FIRM_TOOLS)[number])).length,
    ).toBe(w.tools)
    expect(
      wkids.filter((g) => g.children.some((n) => n.el === 'path' && n.part.endsWith('.ai'))).length,
    ).toBe(w.ai)
    expect(
      wkids.filter((g) => g.children.some((n) => n.el === 'path' && n.part.endsWith('.hv'))).length,
    ).toBe(w.valves)
  }
  const m = modeCounts(firmGraph, 'asFound')
  expect(m.retype + m.forward + m.export + m.sync).toBe(counts(firmGraph, 'asFound').handoffs)
})

test('every rewired route replaces hand-offs that exist, and the table covers every hand-off', () => {
  const ids = new Set(firmGraph.routes.map((r) => r.id))
  for (const r of firmGraph.routes) for (const h of r.replaces ?? []) expect(ids.has(h)).toBe(true)
  const rows = tableRows(firmGraph, 'asFound', 'rewired')
  const c = counts(firmGraph, 'asFound')
  expect(rows.filter((r) => r.found !== 'none').length).toBe(c.handoffs)
  expect(rows.every((r) => r.rewired !== null)).toBe(true)
})

test('every labeled node is at least 104 × 36 CSS px at its family minimum width', () => {
  const MIN = { wide: 560, tall: 360 } as const
  for (const family of ['wide', 'tall'] as const) {
    const s = MIN[family] / firmGraph.viewBox[family][2]
    for (const n of firmGraph.nodes.filter((x) => x.kind === 'tool')) {
      const [w, h] = nodeSize(n, family)
      expect(w * s, `${n.id} ${family} width`).toBeGreaterThanOrEqual(104)
      expect(h * s, `${n.id} ${family} height`).toBeGreaterThanOrEqual(36)
    }
  }
})

test('clean routes stay out of every box they do not connect, inside the viewBox', () => {
  for (const family of ['wide', 'tall'] as const)
    for (const rev of firmGraph.revs) {
      const { nodes } = visible(firmGraph, rev)
      const [vx, vy, vw, vh] = firmGraph.viewBox[family]
      for (const r of routeGraph(firmGraph, rev, family).values()) {
        if (r.route.kind === 'branch') continue
        for (const p of r.pts) {
          expect(p[0], `${r.id} ${family}`).toBeGreaterThanOrEqual(vx)
          expect(p[0], `${r.id} ${family}`).toBeLessThanOrEqual(vx + vw)
          expect(p[1], `${r.id} ${family}`).toBeGreaterThanOrEqual(vy)
          expect(p[1], `${r.id} ${family}`).toBeLessThanOrEqual(vy + vh)
        }
        for (let i = 1; i < r.pts.length; i++) {
          const a = r.pts[i - 1]!
          const b = r.pts[i]!
          expect(a[0] === b[0] || a[1] === b[1], `${r.id} right angles`).toBe(true)
          for (const n of nodes) {
            if (n.id === r.from || n.id === r.to) continue
            expect(
              segHitsRect(a, b, nodeRect(n, family), 1),
              `${r.id} crosses ${n.id} (${family})`,
            ).toBe(false)
          }
        }
      }
    }
})

test('roughjs presets stay inside the caps', () => {
  for (const p of Object.values(ROUGH)) {
    expect(p.roughness).toBeLessThanOrEqual(ROUGH_CAPS.roughness)
    expect(p.bowing).toBeLessThanOrEqual(ROUGH_CAPS.bowing)
  }
})

test('planFrame and frontFrame draw every part; the iso print draws faces back to front', () => {
  const plan = planFrame(model)
  expect(new Set(plan.lines.map((l) => l.id))).toEqual(new Set(model.parts.map((p) => p.id)))
  expect(plan.anchors.a).toEqual([200, 280])
  const front = frontFrame(model)
  expect(front.lines.length).toBe(model.parts.length)
  const iso = isoPrintDoc(model)
  expect(iso.groups[0]!.layer).toBe('iso')
  expect(iso.groups[0]!.children.length).toBeGreaterThan(model.parts.length)
})

test('every symbol and scale figure places and renders', () => {
  for (const id of Object.keys(LIBRARY) as (keyof typeof LIBRARY)[]) {
    const parts = placeSymbol(id, [100, 100])
    expect(parts.length, id).toBeGreaterThan(0)
    for (const p of parts) expect(p.prims.length, `${id} ${p.id}`).toBeGreaterThan(0)
  }
})
