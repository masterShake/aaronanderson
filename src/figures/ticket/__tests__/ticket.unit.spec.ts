import { test, expect } from '@playwright/test'
import { counts, modeCounts } from '@/drawings/lib/counts'
import { nodeRect } from '@/drawings/lib/route'
import { TICKET_REVS, ticketGraph } from '@/drawings/graphs/ticket'
import { TICKET_EXTRAS, TICKET_VIEW, ticketGeometry } from '@/drawings/views/ticket'
import { ticketFigure } from '@/content/figures/ticket'

/**
 * The ticket graph: the counts the tape and the long description print, the
 * label boxes, and that every revision has its chip and every node its label.
 */

test('as found: six hand-offs, two retyped; rewired: one hand-off, none retyped', () => {
  // the spec's numbers, checked here once so copy never has to carry them
  expect(counts(ticketGraph, 'rev0').handoffs).toBe(6)
  expect(modeCounts(ticketGraph, 'rev0').retype).toBe(2)
  for (const rev of TICKET_REVS.slice(1)) {
    expect(counts(ticketGraph, rev).handoffs).toBe(1)
    expect(modeCounts(ticketGraph, rev).retype).toBe(0)
  }
})

test('every labeled node is at least 104 × 36 CSS px at its family minimum width', () => {
  // wide from a 560 px container; tall down to a 300 px container
  const min = { wide: 560, tall: 300 } as const
  for (const fam of ['wide', 'tall'] as const) {
    const g = ticketGeometry(fam).graph
    const scale = min[fam] / TICKET_VIEW.viewBox![fam][2]
    for (const n of g.nodes) {
      const r = nodeRect(n, fam)
      expect(r.w * scale, `${fam} ${n.id} width`).toBeGreaterThanOrEqual(104)
      expect(r.h * scale, `${fam} ${n.id} height`).toBeGreaterThanOrEqual(36)
    }
  }
})

test('nodes and marks stay inside the viewBox; every rev has a chip and every node a label', () => {
  for (const fam of ['wide', 'tall'] as const) {
    const [, , w, h] = TICKET_EXTRAS[fam].viewBox
    for (const n of ticketGeometry(fam).graph.nodes) {
      const r = nodeRect(n, fam)
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h, n.id).toBe(true)
    }
  }
  for (const rev of TICKET_REVS) expect(ticketFigure.revs[rev]).toBeTruthy()
  for (const n of ticketGraph.nodes) expect(ticketFigure.labels[n.label]).toBeTruthy()
})
