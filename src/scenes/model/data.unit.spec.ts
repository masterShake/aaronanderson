import { writeFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { LayoutId } from '@/drawings/types'
import { planFrame } from '@/drawings/lib/frame'
import { HERO_DATA } from './data'
import { S06_EXTRA } from './s06-data'
import { buildS06Model } from '@/drawings/views/s06'
import { buildHeroSceneData } from './spec'
import { isSolid, partLines } from './frame-lite'

/**
 * The firm model ships to the hero scene precomputed (C5), so the scene chunk never imports
 * lib/frame or lib/route. These tests keep the copy honest: data.ts equals the live build, and
 * the scene's frame-lite draws exactly planFrame's lines.
 * Regenerate with GEN_OUT=<file> npm run test:unit -- src/scenes/model (writes the JSON there).
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']

test('data.ts equals the live firm model, both families', () => {
  const live = Object.fromEntries(FAMILIES.map((f) => [f, buildHeroSceneData(f)]))
  if (process.env.GEN_OUT) writeFileSync(process.env.GEN_OUT, JSON.stringify(live))
  for (const f of FAMILIES) expect(HERO_DATA[f]).toEqual(JSON.parse(JSON.stringify(live[f])))
})

test('frame-lite draws planFrame: same lines, pens, inks and fills', () => {
  for (const f of FAMILIES) {
    const spec = HERO_DATA[f].spec
    const frame = planFrame(spec)
    const lite = spec.parts.flatMap(partLines)
    expect(lite.length).toBe(frame.lines.length)
    lite.forEach((l, i) => {
      const fl = frame.lines[i]!
      expect(l.id).toBe(fl.id)
      expect(l.pen).toBe(fl.pen)
      expect(l.ink).toBe(fl.ink)
      expect(l.closed).toBe(fl.closed)
      expect(l.r ?? 0).toBe(fl.r ?? 0)
      expect(l.pts.length).toBe(fl.pts.length)
      l.pts.forEach((p, j) => {
        expect(p[0]).toBeCloseTo(fl.pts[j]![0], 6)
        expect(p[1]).toBeCloseTo(fl.pts[j]![1], 6)
      })
    })
    const fills = spec.parts.filter(isSolid).flatMap((p) => p.prims.map(() => p.id))
    expect(fills.length).toBe(frame.fills.length)
  }
})

test('s06-data.ts holds exactly what S-06 adds to the hero model (wide)', () => {
  const full = buildS06Model('wide').spec.parts
  const hero = new Set(HERO_DATA.wide.spec.parts.map((p) => p.id))
  const extra = full.filter((p) => !hero.has(p.id))
  if (process.env.GEN_OUT) writeFileSync(`${process.env.GEN_OUT}.s06`, JSON.stringify(extra))
  expect(S06_EXTRA).toEqual(JSON.parse(JSON.stringify(extra)))
  // and S-06's plan is the hero's plus those parts, in that order
  expect(full.map((p) => p.id)).toEqual([
    ...HERO_DATA.wide.spec.parts.map((p) => p.id),
    ...extra.map((p) => p.id),
  ])
})

test('every labelled part keeps its anchor; nothing is a zero-length segment', () => {
  for (const f of FAMILIES) {
    const { spec } = HERO_DATA[f]
    const anchors = spec.parts.flatMap((p) => (p.anchor ? [p.anchor] : []))
    expect(anchors).toEqual(expect.arrayContaining(['sym.ai', 'sym.valve', 'sym.store']))
    // the scene reads routes off the pipe parts and the valve branch off the ticket line
    const r02 = spec.parts.find((p) => p.id === 'r02')!
    expect(r02.prims).toHaveLength(2)
    expect(spec.parts.filter((p) => p.kind === 'tank')).toHaveLength(1)
    const routes = spec.parts.flatMap((p) =>
      p.kind === 'pipe' && p.prims[0]!.t === 'poly' ? [p.prims[0]!.pts] : [],
    )
    for (const pts of routes)
      for (let i = 1; i < pts.length; i++)
        expect(
          Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]),
        ).toBeGreaterThan(0)
  }
})
