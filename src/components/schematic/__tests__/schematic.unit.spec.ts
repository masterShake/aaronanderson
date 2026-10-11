import { test, expect } from '@playwright/test'
import type { FigureCopy } from '@/content/types'
import { firmGraph, FIRM_TOOLS } from '@/drawings/graphs/firm'
import { touches } from '@/drawings/lib/counts'
import { calloutText } from '../callout'
import { schematicCopy, fill } from '../copy'
import { nearest } from '../nearest'

/**
 * Callout text comes from the graph (pages-drawings §3.4), and arrow keys find
 * the nearest tool. Templates here are test fixtures, not site copy; every
 * expected number comes from touches().
 */

const fixture = {
  id: 'firm',
  detail: 'D',
  title: 'T',
  caption: 'C',
  longDescription: ['L'],
  labels: {},
  ui: {
    asFound: 'Touches {n} {tools}. {k} by hand: {items}.',
    asFoundNone: 'Touches {n} {tools}. Nothing by hand.',
    rewired: '{c} {connections}: {clauses}.',
    toolOne: 'tool',
    toolMany: 'tools',
    connectionOne: 'connection',
    connectionMany: 'connections',
    'bucket.auto': '{n} automatic',
    'bucket.ai': '{n} read by AI',
    'bucket.hv': '{n} signed off',
    'bucket.aiHv': '{n} read by AI, exceptions signed off',
    'bucket.keep': '{n} unchanged',
  },
} satisfies FigureCopy

test('as-found callouts count the tools touched and the hand-offs done by hand', () => {
  const c = schematicCopy(fixture, [])
  for (const tool of FIRM_TOOLS) {
    const t = touches(firmGraph, 'asFound', tool)
    const text = calloutText(firmGraph, tool, 'asFound', c)
    const head = fill('Touches {n} {tools}.', {
      n: t.touches,
      tools: t.touches === 1 ? 'tool' : 'tools',
    })
    expect(text.body.startsWith(head), `${tool}: ${text.body}`).toBe(true)
    if (t.manual) expect(text.body).toContain(`${t.manual} by hand`)
    else expect(text.body).toContain('Nothing by hand')
  }
})

test('rewired callouts account for every connection exactly once', () => {
  const c = schematicCopy(fixture, [])
  for (const tool of FIRM_TOOLS) {
    const t = touches(firmGraph, 'rewired', tool)
    const total =
      t.automated +
      t.viaAi +
      t.atValve -
      firmGraph.routes.filter(
        (r) =>
          r.ai &&
          r.valve &&
          r.revs?.includes('rewired') &&
          [r.from, r.to].some((e) => e.startsWith(`${tool}.`)),
      ).length
    const text = calloutText(firmGraph, tool, 'rewired', c)
    const sum = [...text.body.matchAll(/(\d+) (automatic|read|signed|unchanged)/g)].reduce(
      (s, m) => s + Number(m[1]),
      0,
    )
    const head = Number(/^(\d+)/.exec(text.body)?.[1])
    expect(sum, `${tool}: ${text.body}`).toBe(head)
    expect(head).toBeGreaterThanOrEqual(total)
  }
})

test('missing copy shows its key, and is listed', () => {
  const c = schematicCopy({ ...fixture, ui: {} }, ['tool.crm'])
  expect(c.ui('toggleLabel')).toBe('toggleLabel')
  expect(c.label('tool.crm')).toBe('tool.crm')
  expect(c.missing).toContain('tool.crm')
})

test('nearest() moves in the pressed direction and never wraps', () => {
  const box = (x: number, y: number) => ({ x, y, width: 10, height: 10 })
  const cands = [
    { el: 'right', r: box(100, 0) },
    { el: 'down', r: box(0, 100) },
    { el: 'diag', r: box(100, 100) },
  ]
  expect(nearest(box(0, 0), cands, 'right')?.el).toBe('right')
  expect(nearest(box(0, 0), cands, 'down')?.el).toBe('down')
  expect(nearest(box(0, 0), cands, 'left')).toBeNull()
  expect(nearest(box(0, 0), cands, 'up')).toBeNull()
})
