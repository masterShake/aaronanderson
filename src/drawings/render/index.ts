import type { DrawingBuilder, DrawingBundle, Graph, Layer, LayoutId, SvgDoc } from '../types'
import { LAYERS } from '../types'
import { layerMarkup, toStillSvg, type BakeOptions } from '../lib/svg-string'
import { graphDoc, type Medium } from './graph'

/**
 * What /drawings/[file] serves, built from SvgDocs:
 *   {figure}.{family}.json              DrawingBundle (one markup string per layer)
 *   {figure}.{family}[.{state}].still.svg  baked, self-contained still
 * Figure lanes call graphBuilder() (or docsBuilder()) from their drawing.server.ts.
 */

export { pencil } from './pencil'
export { cad, frameNodes, partsNodes } from './cad'
export { graphDoc, graphRoutes } from './graph'
export { isoPrintDoc, modelBounds } from './iso'
export { tableRows } from './table'

/** Median --k per family (user units per CSS px) for baked stills. */
export const STILL_K: Readonly<Record<LayoutId, number>> = { wide: 1.18, tall: 0.92 }

/** Merge docs (same viewBox) into one, keeping each group's layer and rev. */
export function mergeDocs(docs: readonly SvgDoc[]): SvgDoc {
  return { viewBox: docs[0]!.viewBox, groups: docs.flatMap((d) => d.groups) }
}

/** The layer bundle of a doc. */
export function bundle(doc: SvgDoc): DrawingBundle {
  const layers: Partial<Record<Layer, string>> = {}
  for (const l of LAYERS) {
    const m = layerMarkup(doc, l)
    if (m) layers[l] = m
  }
  return { v: 1, vb: [doc.viewBox[2], doc.viewBox[3]], layers }
}

export interface StateSpec {
  rev: string
  medium: Medium
  /** Ground ink for the still: 'paper' or 'deep'. */
  ground: 'paper' | 'deep'
  /** Earlier states drawn underneath as a ghost (opacity) in this still. */
  ghost?: number
}

const remapFor = (ground: StateSpec['ground']): BakeOptions['remap'] =>
  ground === 'deep' ? { panel: 'deep' } : { panel: 'paper' }

/** A state of a drawing that is not graph-shaped: StateSpec without the graph's medium. */
export type DocStateSpec = Omit<StateSpec, 'medium'>

/** A DrawingBuilder that also hands out its (cached) SvgDocs. */
export type DocsBuilder = DrawingBuilder & { doc(family: LayoutId, rev: string): SvgDoc }

/**
 * A DrawingBuilder from any SvgDoc factory, for figures that are not graph-shaped
 * (S-05, the strata, the org chart). `make(family, rev)` returns the doc of one state in
 * one family (same viewBox for every state of a family; each group tagged with its rev);
 * it is called once per pair. Files: {family}.json with every state's layers, and one
 * {family}.{rev}.still.svg per state (earlier states ghosted under it when `ghost` is set).
 */
export function docsBuilder(
  make: (family: LayoutId, rev: string) => SvgDoc,
  states: readonly DocStateSpec[],
  families: readonly LayoutId[] = ['wide', 'tall'],
): DocsBuilder {
  const cache = new Map<string, SvgDoc>()
  const doc = (family: LayoutId, rev: string) => {
    const key = `${family}:${rev}`
    let d = cache.get(key)
    if (!d) {
      d = make(family, rev)
      cache.set(key, d)
    }
    return d
  }
  const files = families.flatMap((f) => [
    `${f}.json`,
    ...states.map((s) => `${f}.${s.rev}.still.svg`),
  ])
  return {
    files,
    doc,
    build(file) {
      const family = file.split('.')[0] as LayoutId
      if (file.endsWith('.json'))
        return JSON.stringify(bundle(mergeDocs(states.map((s) => doc(family, s.rev)))))
      const rev = file.split('.')[1]!
      const i = states.findIndex((s) => s.rev === rev)
      const s = states[i]!
      const under = s.ghost ? states.slice(0, i).map((x) => doc(family, x.rev)) : []
      const parts = [...under, doc(family, rev)]
      const merged = mergeDocs(parts)
      const opacity: Partial<Record<Layer, number>> = {}
      if (s.ghost) for (const u of under) for (const gr of u.groups) opacity[gr.layer] = s.ghost
      return toStillSvg(merged, {
        k: STILL_K[family],
        ground: s.ground,
        remap: remapFor(s.ground),
        opacity,
      })
    },
  }
}

/**
 * A DrawingBuilder for a graph drawn in several states (as found in pencil,
 * rewired in CAD, …): docsBuilder over graphDoc. Files: {family}.json with
 * every state's layer, and one {family}.{rev}.still.svg per state.
 */
export function graphBuilder(
  g: Graph<string, string>,
  states: readonly StateSpec[],
  families: readonly LayoutId[] = ['wide', 'tall'],
): DocsBuilder {
  return docsBuilder(
    (family, rev) => {
      const s = states.find((x) => x.rev === rev)!
      return graphDoc(g, rev, family, { medium: s.medium })
    },
    states,
    families,
  )
}
