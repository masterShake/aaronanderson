import {
  CanvasTexture,
  Group,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
} from 'three'
import type { ViewBox } from '@/drawings/types'
import { COLOR } from '@/styles/tokens'
import { paperCard } from './materials'

/**
 * Pencil cut-out people (§2.10). A 128 × 256 CanvasTexture stroked in two
 * passes from the symbol's path data: paper (10 px, round) for the cut-out
 * border, then graphite (2 px). Strokes only, no text. The card pivots at
 * the feet. Plan: lying flat, top toward −z, as the SVG draws it; stand-up:
 * slerp to facing the iso camera (a pop-up book move). People never become metal.
 */

export interface CutoutSymbol {
  viewBox: ViewBox
  /** Path data in the symbol's viewBox. */
  d: readonly string[]
}

export interface Cutout {
  group: Group
  /** 0 = flat in plan, 1 = standing, facing the iso camera. */
  stand(t: number): void
  dispose(): void
}

const W = 128
const H = 256
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
const UPRIGHT = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)

function draw(sym: CutoutSymbol): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return c
  const [x, y, w, h] = sym.viewBox
  const s = Math.min(W / w, H / h)
  g.setTransform(s, 0, 0, s, (W - w * s) / 2 - x * s, H - h * s - y * s)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const paths = sym.d.map((d) => new Path2D(d))
  for (const [color, width] of [
    [COLOR.paper, 10],
    [COLOR.graphite, 2],
  ] as const) {
    g.strokeStyle = color
    g.lineWidth = width / s
    for (const p of paths) g.stroke(p)
  }
  return c
}

/** `height` in world units; `at` = the feet, in plan (x, z). */
export function makeCutout(
  sym: CutoutSymbol,
  height: number,
  at: readonly [number, number],
  renderer: WebGLRenderer,
): Cutout {
  const tex = new CanvasTexture(draw(sym))
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const width = (height * W) / H
  const geo = new PlaneGeometry(width, height).translate(0, height / 2, 0)
  const mat = paperCard(tex)
  const card = new Mesh(geo, mat)
  const group = new Group()
  group.position.set(at[0], 0, at[1])
  group.add(card)
  card.quaternion.copy(FLAT)
  return {
    group,
    stand(t) {
      card.quaternion.slerpQuaternions(FLAT, UPRIGHT, Math.max(0, Math.min(1, t)))
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      tex.dispose()
    },
  }
}
