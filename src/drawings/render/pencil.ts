import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'
import type { Prim } from '../types'
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

/** Pencil strokes for a list of primitives: one path per roughjs subpath. */
export function pencil(prims: readonly Prim[], o: PencilOptions): readonly Stroke[] {
  if (!o.seed) throw new Error('pencil(): seed must be non-zero')
  const out: Stroke[] = []
  prims.forEach((p, i) => {
    const opts = options(o, i)
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
