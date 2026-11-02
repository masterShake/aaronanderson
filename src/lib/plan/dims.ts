/**
 * Dimension strings: extension lines, the dimension line, 45° ticks and segment text.
 * Exterior strings dimension to the building line and partition centrelines; text sits 3″ above
 * the line and vertical strings read from the right side of the sheet.
 */
import type { Vec2 } from '@/lib/geom/rect'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { DimRef, DimString } from '@/lib/house/types'
import type { Polyline } from '@/lib/plan/symbols'
import { formatFtIn, type Inch } from '@/lib/units'

export const EXT_GAP: Inch = 3
export const EXT_OVERRUN: Inch = 6
export const LINE_OVERRUN: Inch = 3
export const TICK: Inch = 9
export const TEXT_GAP: Inch = 3

export interface DimText {
  text: string
  at: Vec2
  rot: 0 | 90
}

export interface DimGeometry {
  positions: Inch[]
  extensions: Polyline[]
  line: Polyline
  ticks: Polyline[]
  texts: DimText[]
}

export function refPosition(house: ResolvedHouse, d: DimString, ref: DimRef): Inch {
  const r = house.wall(ref.wall).spec.rect
  const [lo, hi] = d.axis === 'x' ? [r[0], r[2]] : [r[1], r[3]]
  return ref.face === 'lo' ? lo : ref.face === 'hi' ? hi : (lo + hi) / 2
}

export function dimGeometry(house: ResolvedHouse, d: DimString): DimGeometry {
  const fp = house.spec.footprint
  const positions = [...new Set(d.refs.map((r) => refPosition(house, d, r)))].sort((a, b) => a - b)
  const first = positions[0]
  const last = positions[positions.length - 1]
  const h = TICK / Math.SQRT2 / 2
  const P = (s: Inch, t: Inch): Vec2 => (d.axis === 'x' ? [s, t] : [t, s])

  // Which side of the building the string sits on decides where extension lines start.
  const [lo, hi] = d.axis === 'x' ? [fp[1], fp[3]] : [fp[0], fp[2]]
  const outside = d.at > hi ? 1 : d.at < lo ? -1 : 0
  const objectEdge = outside > 0 ? hi : lo
  const extensions: Polyline[] =
    outside === 0
      ? []
      : positions.map((s) => [P(s, objectEdge + outside * EXT_GAP), P(s, d.at + outside * EXT_OVERRUN)])

  const line: Polyline = [P(first - LINE_OVERRUN, d.at), P(last + LINE_OVERRUN, d.at)]
  const ticks: Polyline[] = positions.map((s) =>
    d.axis === 'x'
      ? [
          [s - h, d.at - h],
          [s + h, d.at + h],
        ]
      : [
          [d.at - h, s - h],
          [d.at + h, s + h],
        ],
  )
  const texts: DimText[] = []
  for (let i = 0; i + 1 < positions.length; i++) {
    const s = (positions[i] + positions[i + 1]) / 2
    const text = formatFtIn(positions[i + 1] - positions[i])
    texts.push(
      d.axis === 'x'
        ? { text, at: [s, d.at + TEXT_GAP], rot: 0 }
        : { text, at: [d.at - TEXT_GAP, s], rot: 90 },
    )
  }
  return { positions, extensions, line, ticks, texts }
}
