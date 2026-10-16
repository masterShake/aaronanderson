import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'
import type { Prim, Pt } from '../types'
import { primD, primPts, seedFrom } from '../lib/geometry'
import { primLength } from '../lib/length'
import { ROUGH, ROUGH_CAPS, type PresetId } from '../kit/rough'

/**
 * The pencil renderer: roughjs, generator only, on the server or at build
 * time (the lint fence bans roughjs in *.client.* files). Every call gets a
 * fresh options object with a fixed non-zero seed per element, so the same
 * graph always gives the same strings. Each roughjs set is split at every
 * move into its own path, because dashes restart per subpath.
 */

const gen = rough.generator()

export interface PencilOptions {
  /** Non-zero base seed (figure seed or seedFrom(figure:element)). */
  seed: number
  preset?: PresetId
  /** Overrides, capped at roughness 1.2 and bowing 1. */
  roughness?: number
  bowing?: number
}

export interface Stroke {
  d: string
  len: number
}

function options(o: PencilOptions, i: number): Options {
  const p = ROUGH[o.preset ?? 'line']
  const seed = seedFrom(`${o.seed}:${i}`)
  return {
    seed,
    roughness: Math.min(ROUGH_CAPS.roughness, o.roughness ?? p.roughness),
    bowing: Math.min(ROUGH_CAPS.bowing, o.bowing ?? p.bowing),
    disableMultiStroke: p.disableMultiStroke,
    preserveVertices: p.preserveVertices,
    maxRandomnessOffset: p.maxRandomnessOffset,
    fill: undefined,
    stroke: '#000',
    strokeWidth: 1,
  }
}

function drawable(p: Prim, opts: Options) {
  switch (p.t) {
    case 'line':
      return gen.line(p.a[0], p.a[1], p.b[0], p.b[1], opts)
    case 'rect':
      return gen.rectangle(p.at[0], p.at[1], p.size[0], p.size[1], opts)
    case 'circle':
      return gen.circle(p.c[0], p.c[1], p.r * 2, opts)
    case 'arc':
      return gen.arc(
        p.c[0],
        p.c[1],
        p.r * 2,
        p.r * 2,
        (Math.min(p.from, p.to) * Math.PI) / 180,
        (Math.max(p.from, p.to) * Math.PI) / 180,
        false,
        opts,
      )
    case 'poly':
      return p.closed
        ? gen.polygon(
            p.pts.map((q) => [q[0], q[1]] as [number, number]),
            opts,
          )
        : gen.linearPath(
            p.pts.map((q) => [q[0], q[1]] as [number, number]),
            opts,
          )
    case 'cubic':
      return gen.curve(
        primPts(p, 12).map((q) => [q[0], q[1]] as [number, number]),
        opts,
      )
    case 'path':
      return gen.path(primD(p), opts)
  }
}

/** Split path data at every move command. */
export function splitMoves(d: string): string[] {
  return d
    .split(/(?=M)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
}

/** Presets drawn as straight segments with overshoot (see kit/rough.ts). */
const STRAIGHT: ReadonlySet<PresetId> = new Set(['box', 'line', 'detail'])

/**
 * The straight segments of a rect or an unfilleted polyline, each with a flag
 * per end: true where the end is a corner (it overshoots there). Null for
 * anything curved.
 */
function straights(p: Prim): { a: Pt; b: Pt; ca: boolean; cb: boolean }[] | null {
  let pts: Pt[]
  let closed: boolean
  if (p.t === 'line') {
    pts = [p.a, p.b]
    closed = false
  } else if (p.t === 'rect') {
    pts = primPts(p)
    closed = true
  } else if (p.t === 'poly' && !p.r) {
    pts = [...p.pts]
    closed = p.closed ?? false
  } else return null
  const n = pts.length
  if (n < 2) return null
  const segs = closed ? n : n - 1
  return Array.from({ length: segs }, (_, j) => ({
    a: pts[j]!,
    b: pts[(j + 1) % n]!,
    ca: closed || j > 0,
    cb: closed || j < n - 2,
  }))
}

/** A confident straight: overshoot past corners, bow eased off with length. */
function straightStroke(
  s: { a: Pt; b: Pt; ca: boolean; cb: boolean },
  opts: Options,
  detail: boolean,
): Stroke[] {
  const dx = s.b[0] - s.a[0]
  const dy = s.b[1] - s.a[1]
  const l = Math.hypot(dx, dy)
  if (l < 0.01) return []
  const ux = dx / l
  const uy = dy / l
  const ov = detail ? 0 : Math.min(2.4, l * 0.06)
  const a: Pt = s.ca ? [s.a[0] - ux * ov, s.a[1] - uy * ov] : s.a
  const b: Pt = s.cb ? [s.b[0] + ux * ov, s.b[1] + uy * ov] : s.b
  const ease = Math.min(1, 80 / l)
  const o: Options = {
    ...opts,
    bowing: (opts.bowing ?? 1) * ease,
    roughness: (opts.roughness ?? 1) * (0.55 + 0.45 * ease),
  }
  const ds = gen
    .line(a[0], a[1], b[0], b[1], o)
    .sets.filter((set) => set.type === 'path')
    .flatMap((set) => splitMoves(gen.opsToPath(set, 2)))
  const len = (l + (s.ca ? ov : 0) + (s.cb ? ov : 0)) / Math.max(1, ds.length)
  return ds.map((d) => ({ d, len: Math.round(len * 100) / 100 }))
}

/** Pencil strokes for a list of primitives: one path per roughjs subpath. */
export function pencil(prims: readonly Prim[], o: PencilOptions): readonly Stroke[] {
  if (!o.seed) throw new Error('pencil(): seed must be non-zero')
  const out: Stroke[] = []
  const preset = o.preset ?? 'line'
  prims.forEach((p, i) => {
    const opts = options(o, i)
    const segs = STRAIGHT.has(preset) ? straights(p) : null
    if (segs) {
      segs.forEach((s, j) =>
        out.push(
          ...straightStroke(
            s,
            { ...opts, seed: seedFrom(`${o.seed}:${i}:${j}`) },
            preset === 'detail',
          ),
        ),
      )
      return
    }
    const dr = drawable(p, opts)
    const ds = dr.sets
      .filter((set) => set.type === 'path')
      .flatMap((set) => splitMoves(gen.opsToPath(set, 2)))
    // each pass covers the whole primitive once; share its length among the subpaths of a pass
    const passes = opts.disableMultiStroke ? 1 : 2
    const len = (primLength(p) * passes) / Math.max(1, ds.length)
    for (const d of ds) out.push({ d, len: Math.round(len * 100) / 100 })
  })
  return out
}
