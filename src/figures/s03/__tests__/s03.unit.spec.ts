import { test, expect } from '@playwright/test'
import type { LayoutId } from '@/drawings/types'
import { frontFrame } from '@/drawings/lib/frame'
import { S03_COUNTS, S03_LABELS, S03_LABEL_GROUPS, type S03LabelKey } from '@/drawings/views/s03'
import { s03Figure as copy } from '@/content/figures/s03'
import { S03, S03_HELD_MS } from '@/motion/timing/s03'
import { S03_FAMILY, s03Spec, sectionFrame, MOVING } from '@/scenes/s03/section'
import { s03Doc, s03Drawing, s03Frame } from '../drawing'

/**
 * S-03 layout and drawing checks: the scene's hand-off frame is the SVG's (frontFrame plus
 * the section details), every label box (≥ 104 × 36 CSS px) fits its family at the family's
 * narrowest container without overlapping another, the files carry no text and no
 * vector-effect, and the demo counts come from the batch.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
/** The narrowest container per family (CSS px): services wide from 440, tall at 360. */
const MIN_PX: Readonly<Record<LayoutId, number>> = { wide: 440, tall: 360 }
/**
 * Label boxes in CSS px as Chrome draws them (Martian Mono 12 px, 0.06em tracking, wrapping
 * at 128 px; S03.module.css), measured on the /kit/fig/s03 harness, plus 4 px of slack for
 * font drift. e2e/figures/s03.spec.ts measures the real boxes at the same widths.
 */
const SLACK = 4
const SIZE: Readonly<Record<S03LabelKey, readonly [w: number, h: number]>> = {
  hopper: [128, 40],
  tolerance: [123, 36],
  reader: [128, 57],
  gate: [128, 40],
  output: [104, 36],
  tray: [128, 57],
  section: [128, 40],
  'doc.invoice': [104, 36],
  'doc.ticket': [128, 57],
  'doc.submittal': [113, 36],
  card: [128, 100],
}

/** The label strings exist in content (keys are not invented here). */
function labelText(k: S03LabelKey): string {
  if (k === 'card') return copy.ui['card.vendor'] as string
  return copy.labels[k as keyof typeof copy.labels]
}

function box(k: S03LabelKey, f: LayoutId) {
  const vb = S03_FAMILY[f].vb
  const px = MIN_PX[f] / vb[2]
  expect(labelText(k), `${k} copy`).toBeTruthy()
  const w = Math.max(104, SIZE[k][0] + SLACK)
  const h = Math.max(36, SIZE[k][1] + SLACK)
  const [x, y] = S03_LABELS[k][f]
  return { x: x * px, y: y * px, w, h, W: vb[2] * px, H: vb[3] * px }
}

test('the scene frame is frontFrame plus the section details', () => {
  for (const f of FAMILIES) {
    expect(sectionFrame(f)).toEqual(s03Frame(f))
    const rects = frontFrame(s03Spec(f))
    const ids = new Set(rects.lines.map((l) => l.id))
    expect(sectionFrame(f).lines.filter((l) => ids.has(l.id))).toEqual(rects.lines)
    for (const id of MOVING) expect(sectionFrame(f).lines.some((l) => l.id === id)).toBe(true)
  }
})

test('label boxes fit their family and never overlap', () => {
  const keys = Object.keys(S03_LABELS) as S03LabelKey[]
  const together = (a: S03LabelKey, b: S03LabelKey) =>
    S03_LABEL_GROUPS.some((g) => g.includes(a) && g.includes(b))
  for (const f of FAMILIES) {
    for (const k of keys) {
      const b = box(k, f)
      expect(b.w, `${k} width`).toBeGreaterThanOrEqual(104)
      expect(b.h, `${k} height`).toBeGreaterThanOrEqual(36)
      expect(b.x + b.w, `${k} right edge (${f})`).toBeLessThanOrEqual(b.W + 0.5)
      expect(b.y + b.h, `${k} bottom edge (${f})`).toBeLessThanOrEqual(b.H + 0.5)
    }
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        const [a, c] = [keys[i]!, keys[j]!]
        if (together(a, c)) continue
        const A = box(a, f)
        const C = box(c, f)
        const overlap = A.x < C.x + C.w && C.x < A.x + A.w && A.y < C.y + C.h && C.y < A.y + A.h
        expect(overlap, `${a} overlaps ${c} (${f})`).toBe(false)
      }
  }
})

test('files: no text, no vector-effect, every state', () => {
  expect(s03Drawing.files).toEqual([
    'wide.json',
    'wide.held.still.svg',
    'wide.approved.still.svg',
    'tall.json',
    'tall.held.still.svg',
    'tall.approved.still.svg',
  ])
  for (const file of s03Drawing.files) {
    const body = s03Drawing.build(file)
    expect(body).not.toMatch(/<text|vector-effect|non-scaling/)
    if (file.endsWith('.svg')) expect(body.startsWith('<svg')).toBe(true)
  }
  const held = s03Drawing.build('wide.held.still.svg')
  const approved = s03Drawing.build('wide.approved.still.svg')
  expect(held).not.toBe(approved)
  // three cards after approval, two while held
  expect(approved.split('#F4F2EC" stroke="#BFE6F5"').length).toBeGreaterThan(
    held.split('#F4F2EC" stroke="#BFE6F5"').length,
  )
  for (const f of FAMILIES) expect(s03Doc(f).viewBox).toEqual(S03_FAMILY[f].vb)
})

test('demo counts and timing', () => {
  expect(S03_COUNTS).toEqual({ entered: 2, held: 1 })
  expect(S03.handoffP).toBe(0.38)
  expect(S03.motionFromP).toBe(0.62)
  expect(S03.detailToP).toBeLessThanOrEqual(S03.handoffP)
  expect(S03.detailFromP + S03.detailStaggerP * 5 + S03.strokeP).toBeLessThanOrEqual(S03.handoffP)
  expect(S03.sketchFromP + 8 * S03.sketchStaggerP + S03.strokeP).toBeLessThanOrEqual(S03.cutToP)
  // HELD within 7 s of the batch start (stage-hero §4.2 ship gate)
  expect(S03_HELD_MS).toBeLessThanOrEqual(7000)
})
