import { Color } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'

/**
 * Lines (§2.2): LineSegments2 + LineMaterial in CSS px (worldUnits false;
 * LineSegments2.onBeforeRender writes the CSS-px viewport as `resolution` on
 * every draw). Width is SceneContext.strokePx(pen) = pen × k × unitPx, so it
 * matches the SVG stroke. Never tone mapped. The edge fade defaults to a
 * colour fade toward the face tone at opacity 1; alpha-to-coverage stays off
 * unless the 1440@2 / 1280@1 side-by-side passes (critic risk 3).
 */

export interface LineOpts {
  color: string | number
  width: number
  opacity?: number
  /** USE_DASH changes the shader, so draw-on lines must say so at build time. */
  dashed?: boolean
  a2c?: boolean
}

export function lineMat(o: LineOpts): LineMaterial {
  const opacity = o.opacity ?? 1
  return new LineMaterial({
    color: new Color(o.color).getHex(),
    linewidth: o.width,
    worldUnits: false,
    toneMapped: false,
    opacity,
    transparent: !o.a2c && opacity < 1,
    alphaToCoverage: !!o.a2c,
    dashed: !!o.dashed,
    dashSize: 1,
    gapSize: 0,
  })
}

/** Pairs of xyz points (6 numbers per segment). Never pass a zero-length segment. */
export function segments(pos: ArrayLike<number>, m: LineMaterial): LineSegments2 {
  const g = new LineSegmentsGeometry().setPositions(Array.from(pos))
  return new LineSegments2(g, m)
}

export function polyline(pts: ArrayLike<number>, m: LineMaterial): Line2 {
  const l = new Line2(new LineGeometry().setPositions(Array.from(pts)), m)
  l.computeLineDistances()
  return l
}

/** Draw-on for a dashed line of length `len`, t from 0 to 1. */
export function drawOn(l: Line2, len: number, t: number): void {
  const m = l.material
  m.dashSize = len
  m.gapSize = len
  m.dashOffset = len * (1 - t)
}

const _a = new Color()
const _b = new Color()
/** Fades an edge from its colour toward the face tone at opacity 1 (no blending). */
export function fadeEdge(m: LineMaterial, from: string | number, to: string | number, t: number) {
  m.color.copy(_a.set(from)).lerp(_b.set(to), t)
}

/** Sets a line material's width in CSS px (after a resize). */
export function setWidth(m: LineMaterial, px: number): void {
  m.linewidth = px
}
