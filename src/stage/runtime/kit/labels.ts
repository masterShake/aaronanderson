import { Vector3, type Camera, type Object3D } from 'three'

/**
 * Label projection (§2.9). Anchors are Object3Ds, so they follow their
 * parents. The runtime turns the returned map into --ix/--iy on the
 * figure's [data-anchor] spans (writes only on a change over 0.25 px).
 * No text in the canvas: labels are HTML.
 */

export type LabelMap = Map<string, { x: number; y: number; visible: boolean }>

const _v = new Vector3()

/** Projects anchors to slot-relative CSS px. */
export function projectAnchors(
  anchors: ReadonlyMap<string, Object3D>,
  camera: Camera,
  cssW: number,
  cssH: number,
  visible: (key: string) => boolean = () => true,
  out: LabelMap = new Map(),
): LabelMap {
  for (const [key, obj] of anchors) {
    obj.getWorldPosition(_v).project(camera)
    const inside = _v.x >= -1 && _v.x <= 1 && _v.y >= -1 && _v.y <= 1
    out.set(key, {
      x: ((_v.x + 1) / 2) * cssW,
      y: ((1 - _v.y) / 2) * cssH,
      visible: inside && visible(key),
    })
  }
  return out
}
