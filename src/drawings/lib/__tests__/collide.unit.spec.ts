import { test, expect } from '@playwright/test'
import { edgesOf, labelCollisions, segmentHitsBox } from '../collide'

/** The label collision check (kit M4): label/label, label/edge and label/frame overlaps. */

const frame = { x: 0, y: 0, w: 400, h: 200 }

test('segments hit a box only when they pass through it', () => {
  const r = { x: 10, y: 10, w: 20, h: 10 }
  expect(segmentHitsBox([0, 15], [40, 15], r)).toBe(true)
  expect(segmentHitsBox([0, 0], [40, 0], r)).toBe(false)
  // running along the edge only touches it
  expect(segmentHitsBox([0, 10], [40, 10], r)).toBe(false)
  expect(segmentHitsBox([15, 0], [15, 5], r)).toBe(false)
  expect(segmentHitsBox([15, 0], [15, 12], r)).toBe(true)
})

test('a clean state reports nothing', () => {
  const box = edgesOf('crm', [{ t: 'rect', at: [20, 20], size: [180, 64] }])
  const pipe = edgesOf('r01', [{ t: 'line', a: [200, 52], b: [380, 52] }])
  const labels = [
    { id: 'crm', x: 28, y: 44, w: 60, h: 14, owner: 'crm' },
    { id: 'carry', x: 240, y: 30, w: 80, h: 14 },
  ]
  expect(labelCollisions({ labels, edges: [...box, ...pipe], frame })).toEqual([])
})

test('overlapping labels, crossed lines and labels off the frame are reported', () => {
  const pipe = edgesOf('r01', [
    {
      t: 'poly',
      pts: [
        [0, 100],
        [300, 100],
        [300, 190],
      ],
    },
  ])
  const labels = [
    { id: 'a', x: 20, y: 94, w: 50, h: 14 },
    { id: 'b', x: 60, y: 60, w: 50, h: 40 },
    { id: 'c', x: 380, y: 10, w: 40, h: 14 },
  ]
  const hits = labelCollisions({ labels, edges: pipe, frame })
  expect(hits).toContainEqual({ kind: 'label-label', a: 'a', b: 'b' })
  expect(hits).toContainEqual({ kind: 'label-edge', a: 'a', b: 'r01' })
  expect(hits).toContainEqual({ kind: 'label-frame', a: 'c', b: 'frame' })
  // one report per label and edge id, however many segments cross
  expect(hits.filter((h) => h.kind === 'label-edge' && h.a === 'a')).toHaveLength(1)
})

test('padding asks for clear space; an owner box may hold its label', () => {
  const box = edgesOf('tool', [{ t: 'rect', at: [0, 0], size: [100, 40] }])
  const inside = { id: 'tool', x: 8, y: 13, w: 60, h: 14, owner: 'tool' }
  expect(labelCollisions({ labels: [inside], edges: box }, { pad: 4 })).toEqual([])
  // the same label pushed onto its box edge collides
  const onEdge = { ...inside, y: -6 }
  expect(labelCollisions({ labels: [onEdge], edges: box })).toContainEqual({
    kind: 'label-edge',
    a: 'tool',
    b: 'tool',
  })
  // a stranger's label 2 units from a line passes bare, fails with pad 4
  const line = edgesOf('r', [{ t: 'line', a: [0, 60], b: [100, 60] }])
  const near = { id: 'n', x: 10, y: 44, w: 40, h: 14 }
  expect(labelCollisions({ labels: [near], edges: line })).toEqual([])
  expect(labelCollisions({ labels: [near], edges: line }, { pad: 4 })).toHaveLength(1)
})
