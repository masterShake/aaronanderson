/**
 * Strokes → one LineSegments2 per pen (and per test-fit group), built once. Each segment carries
 * its own [t0, t1] window, element index and along-stroke dash distances, so the whole layer
 * draws itself from a single shared progress uniform.
 */
import { InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute } from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { dist } from '@/lib/geom/rect'
import { segmentWindows, type Timeline } from '@/lib/draft/timeline'
import { PALETTE, PENS, SETTLE, type PenId } from '@/lib/plan/pens'
import type { FitGroup, PlanDrawing } from '@/lib/plan/types'
import { DraftLineMaterial, penColor, type DraftUniforms } from '@/scene/materials/DraftLineMaterial'

export interface LineLayer {
  pen: PenId
  group?: FitGroup
  mesh: LineSegments2
  material: DraftLineMaterial
}

export function buildLines(plan: PlanDrawing, tl: Timeline, shared: DraftUniforms): LineLayer[] {
  const buckets = new Map<string, number[]>()
  plan.strokes.forEach((s, i) => {
    const key = `${s.pen}|${s.group ?? ''}`
    buckets.set(key, [...(buckets.get(key) ?? []), i])
  })

  const layers: LineLayer[] = []
  for (const [key, ids] of buckets) {
    const [pen, group] = key.split('|') as [PenId, FitGroup | '']
    const segCount = ids.reduce((n, i) => n + plan.strokes[i].pts.length - 1, 0)
    const positions = new Float32Array(segCount * 6)
    const times = new Float32Array(segCount * 2)
    const elements = new Float32Array(segCount)
    const distances = new Float32Array(segCount * 2)
    let k = 0
    for (const i of ids) {
      const s = plan.strokes[i]
      const seg = segmentWindows(s.pts, tl.strokes[i * 2], tl.strokes[i * 2 + 1])
      let along = 0
      for (let j = 0; j + 1 < s.pts.length; j++, k++) {
        const [ax, ay] = s.pts[j]
        const [bx, by] = s.pts[j + 1]
        positions.set([ax, ay, 0, bx, by, 0], k * 6)
        times[k * 2] = seg[j * 2]
        times[k * 2 + 1] = seg[j * 2 + 1]
        elements[k] = s.el
        const len = dist(s.pts[j], s.pts[j + 1])
        distances[k * 2] = along
        distances[k * 2 + 1] = along + len
        along += len
      }
    }

    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(positions) // once: in r187 each call allocates a new GPU buffer
    geometry.setAttribute('instanceTime', new InstancedBufferAttribute(times, 2))
    geometry.setAttribute('instanceElement', new InstancedBufferAttribute(elements, 1))
    const dbuf = new InstancedInterleavedBuffer(distances, 2, 1)
    geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(dbuf, 1, 0))
    geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(dbuf, 1, 1))

    const p = PENS[pen]
    const material = new DraftLineMaterial(
      {
        color: PALETTE[p.color],
        linewidth: p.width[0],
        dashed: Boolean(p.dash),
        dashSize: p.dash?.[0] ?? 1,
        gapSize: p.dash?.[1] ?? 1,
        dashScale: 1,
      },
      shared,
      { color: penColor(PALETTE.ai), settle: p.settle ?? SETTLE, settleFrom: p.settleFrom ?? 0 },
    )
    const mesh = new LineSegments2(geometry, material)
    mesh.name = `lines:${key}`
    mesh.renderOrder = p.order
    mesh.frustumCulled = false
    layers.push({ pen, group: group || undefined, mesh, material })
  }
  return layers
}
