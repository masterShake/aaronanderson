/**
 * Fills → one mesh per kind (poché, solid marks, AI washes). Polygons are convex and
 * fan-triangulated; each vertex carries the fill's window, its position along the wipe and the
 * element index.
 */
import { BufferAttribute, BufferGeometry, Color, Mesh } from 'three'
import type { Timeline } from '@/lib/draft/timeline'
import { PALETTE } from '@/lib/plan/pens'
import type { FillKind, PlanDrawing } from '@/lib/plan/types'
import { DraftFillMaterial } from '@/scene/materials/DraftFillMaterial'
import type { DraftUniforms } from '@/scene/materials/DraftLineMaterial'

export interface FillLayer {
  kind: FillKind
  mesh: Mesh
  material: DraftFillMaterial
}

const STYLE: Record<FillKind, { color: string; mode: 'wipe' | 'fade'; order: number }> = {
  wash: { color: PALETTE.aiWash, mode: 'fade', order: -95 },
  poche: { color: PALETTE.poche, mode: 'wipe', order: -90 },
  solid: { color: PALETTE.ink, mode: 'fade', order: -90 },
}

export function buildFills(plan: PlanDrawing, tl: Timeline, shared: DraftUniforms): FillLayer[] {
  const layers: FillLayer[] = []
  for (const kind of ['wash', 'poche', 'solid'] as const) {
    const ids = plan.fills.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === kind)
    if (!ids.length) continue
    const vertCount = ids.reduce((n, { f }) => n + f.poly.length, 0)
    const triCount = ids.reduce((n, { f }) => n + f.poly.length - 2, 0)
    const position = new Float32Array(vertCount * 3)
    const time = new Float32Array(vertCount * 2)
    const wipe = new Float32Array(vertCount)
    const element = new Float32Array(vertCount)
    const index = new Uint32Array(triCount * 3)
    let v = 0
    let t = 0
    for (const { f, i } of ids) {
      const base = v
      const w = f.wipe
      const dx = w ? w.to[0] - w.from[0] : 0
      const dy = w ? w.to[1] - w.from[1] : 0
      const len2 = dx * dx + dy * dy || 1
      for (const [x, y] of f.poly) {
        position.set([x, y, 0], v * 3)
        time[v * 2] = tl.fills[i * 2]
        time[v * 2 + 1] = tl.fills[i * 2 + 1]
        wipe[v] = w ? ((x - w.from[0]) * dx + (y - w.from[1]) * dy) / len2 : 0
        element[v] = f.el
        v++
      }
      for (let k = 1; k + 1 < f.poly.length; k++) index.set([base, base + k, base + k + 1], (t++) * 3)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('aTime', new BufferAttribute(time, 2))
    geometry.setAttribute('aWipe', new BufferAttribute(wipe, 1))
    geometry.setAttribute('aElement', new BufferAttribute(element, 1))
    geometry.setIndex(new BufferAttribute(index, 1))
    const style = STYLE[kind]
    const material = new DraftFillMaterial(new Color(style.color), shared, style.mode)
    const mesh = new Mesh(geometry, material)
    mesh.name = `fills:${kind}`
    mesh.renderOrder = style.order
    mesh.frustumCulled = false
    layers.push({ kind, mesh, material })
  }
  return layers
}
