import type { ModelPart, Pen, Prim, Pt } from '@/drawings/types'

/**
 * planFrame(spec), as much of it as a scene needs, without lib/frame (which pulls lib/route and
 * geometry into the scene chunk). frame-lite.unit.spec.ts asserts it draws exactly what
 * planFrame draws: the same outline points, closures, fillets, pens and inks.
 */

export interface LiteLine {
  id: string
  pts: readonly Pt[]
  closed: boolean
  pen: Pen
  ink: 'cyan' | 'orange' | 'cyan-dim'
  r?: number
}

const PEN: Readonly<Record<ModelPart['kind'], Pen>> = {
  box: '050',
  cyl: '050',
  tank: '050',
  pipe: '070',
  flange: '050',
  valve: '050',
  card: '035',
  slot: '035',
}

/** planFrame's circle tessellation (lib/geometry primPts, n = 48). */
export const CIRCLE_N = 48

export function outline(p: Prim): { pts: Pt[]; closed: boolean; r?: number } {
  switch (p.t) {
    case 'rect': {
      const [x, y] = p.at
      const [w, h] = p.size
      return {
        pts: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ],
        closed: true,
      }
    }
    case 'circle':
      return {
        pts: Array.from({ length: CIRCLE_N }, (_, i) => {
          const a = (((360 * i) / CIRCLE_N) * Math.PI) / 180
          return [p.c[0] + p.r * Math.cos(a), p.c[1] + p.r * Math.sin(a)] as Pt
        }),
        closed: true,
      }
    case 'poly':
      return { pts: [...p.pts], closed: p.closed ?? false, ...(p.r ? { r: p.r } : {}) }
    default:
      return { pts: [], closed: false }
  }
}

/** The frame lines of one part, in planFrame's order and ids. */
export function partLines(p: ModelPart): LiteLine[] {
  const ink = p.material === 'orange' ? 'orange' : p.material === 'line' ? 'cyan-dim' : 'cyan'
  return p.prims.map((prim, i) => {
    const o = outline(prim)
    return {
      id: p.prims.length > 1 ? `${p.id}.${i}` : p.id,
      pts: o.pts,
      closed: o.closed,
      pen: PEN[p.kind],
      ink,
      ...(o.r ? { r: o.r } : {}),
    }
  })
}

/**
 * The page rasterizes SVG strokes with four samples a pixel, so an axis-aligned edge covers its
 * pixel in quarter steps; a 2D canvas covers it exactly. On straight horizontal and vertical
 * runs (a pixel whose neighbours along the run match it) the decal's coverage is rounded to the
 * nearest quarter, as four samples would give; curves and diagonals keep the exact coverage.
 */
export function quarterEdges(d: Uint8ClampedArray, w: number): void {
  const s = d.slice()
  const r = w * 4
  const near = (i: number, o: number) =>
    Math.abs(s[i - o]! - s[i]!) < 32 && Math.abs(s[i + o]! - s[i]!) < 32
  for (let i = r + 3; i < s.length - r; i += 4)
    if (s[i]! % 255 && (near(i, r) || near(i, 4))) d[i] = Math.round(s[i]! / 63.75) * 63.75
}

/**
 * quarterEdges over a painted canvas, 128 rows a task (off the 3D window's long tasks), then
 * `done` (re-upload the texture). Returns a cancel.
 */
export function quarterLater(g: CanvasRenderingContext2D, done: () => void): () => void {
  const { width: w, height: h } = g.canvas
  let y = 1
  let id: ReturnType<typeof setTimeout>
  const step = () => {
    const img = g.getImageData(0, y - 1, w, Math.min(130, h - y + 1))
    quarterEdges(img.data, w)
    g.putImageData(img, 0, y - 1)
    y += 128
    if (y < h - 1) id = setTimeout(step)
    else done()
  }
  id = setTimeout(step)
  return () => clearTimeout(id)
}

/** Solid parts get a filled footprint (planFrame: not a pipe, not a line, closed). */
export const isSolid = (p: ModelPart) => p.kind !== 'pipe' && p.material !== 'line'
