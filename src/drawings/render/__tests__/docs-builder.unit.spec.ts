import { test, expect } from '@playwright/test'
import type { DrawingBundle, Layer, LayoutId, SvgDoc } from '@/drawings/types'
import { docsBuilder, graphBuilder, STILL_K, type DocStateSpec } from '@/drawings/render'
import { firmGraph } from '@/drawings/graphs/firm'
import { FIRM_STATES } from '@/drawings/render/firm'
import { r2 } from '@/drawings/lib/geometry'
import { PEN } from '@/styles/tokens'

/**
 * docsBuilder(): the builder for drawings that are not graph-shaped. Files, layer
 * bundles, ghosted stills, one make() call per (family, rev), determinism, and
 * graphBuilder() being docsBuilder() over graphDoc().
 */

const VB: Readonly<Record<LayoutId, readonly [number, number, number, number]>> = {
  wide: [0, 0, 960, 720],
  tall: [0, 0, 400, 500],
}
const LAYER: Readonly<Record<string, Layer>> = { draft: 'pencil', issued: 'cad' }
const STATES: readonly DocStateSpec[] = [
  { rev: 'draft', ground: 'paper' },
  { rev: 'issued', ground: 'deep', ghost: 0.22 },
]

function setup() {
  const calls: string[] = []
  const make = (family: LayoutId, rev: string): SvgDoc => {
    calls.push(`${family}:${rev}`)
    const [, , w, h] = VB[family]
    return {
      viewBox: [...VB[family]],
      groups: [
        {
          layer: LAYER[rev]!,
          rev,
          children: [
            {
              el: 'path',
              d: `M10 10H${w - 10}V${h - 10}`,
              len: w + h - 40,
              part: `${rev}-box`,
              i: 0,
              cls: rev === 'draft' ? 'p-035 i-pencil draw' : 'p-050 i-cad draw',
            },
          ],
        },
      ],
    }
  }
  return { calls, b: docsBuilder(make, STATES) }
}

test('docsBuilder lists a bundle and one still per state for each family', () => {
  const { b } = setup()
  expect(b.files).toEqual([
    'wide.json',
    'wide.draft.still.svg',
    'wide.issued.still.svg',
    'tall.json',
    'tall.draft.still.svg',
    'tall.issued.still.svg',
  ])
  expect(docsBuilder(setup().b.doc, STATES, ['wide']).files).toEqual([
    'wide.json',
    'wide.draft.still.svg',
    'wide.issued.still.svg',
  ])
})

test('docsBuilder bundles every state, tagged with its rev, in the family viewBox', () => {
  const { b } = setup()
  for (const family of ['wide', 'tall'] as const) {
    const json = JSON.parse(b.build(`${family}.json`)) as DrawingBundle
    expect(json.v).toBe(1)
    expect(json.vb).toEqual([VB[family][2], VB[family][3]])
    expect(Object.keys(json.layers).sort()).toEqual(['cad', 'pencil'])
    expect(json.layers.pencil).toContain('data-rev="draft"')
    expect(json.layers.cad).toContain('data-rev="issued"')
    expect(json.layers.cad).toContain('pathLength="1"')
  }
})

test('docsBuilder bakes stills: ground, the ghosted earlier state, widths at STILL_K', () => {
  const { b } = setup()
  const draft = b.build('wide.draft.still.svg')
  const issued = b.build('wide.issued.still.svg')
  for (const s of [draft, issued]) {
    expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720"')).toBe(true)
    expect(s).not.toContain('class=')
    expect(s).not.toContain('<text')
  }
  // the draft still has only its own layer; the issued still ghosts the draft under it
  expect(draft).not.toContain('opacity=')
  expect(issued).toContain('opacity="0.22"')
  expect(issued.match(/<path /g)?.length).toBe(2)
  expect(draft.match(/<path /g)?.length).toBe(1)
  expect(draft).toContain(`stroke-width="${r2(PEN['035'] * STILL_K.wide)}"`)
})

test('docsBuilder calls make once per family and rev, and is deterministic', () => {
  const { b, calls } = setup()
  const first = b.files.map((f) => b.build(f))
  const again = b.files.map((f) => b.build(f))
  expect(again).toEqual(first)
  expect([...calls].sort()).toEqual(['tall:draft', 'tall:issued', 'wide:draft', 'wide:issued'])
  const other = setup().b
  expect(other.files.map((f) => other.build(f))).toEqual(first)
  expect(b.doc('wide', 'issued')).toBe(b.doc('wide', 'issued'))
})

test('graphBuilder is docsBuilder over graphDoc: same files, same bytes', () => {
  const g = graphBuilder(firmGraph, FIRM_STATES)
  const d = docsBuilder((family, rev) => g.doc(family, rev), FIRM_STATES)
  expect(d.files).toEqual(g.files)
  for (const f of g.files) expect(d.build(f)).toBe(g.build(f))
})
