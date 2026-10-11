import { firmGraph } from '../graphs/firm'
import { graphBuilder, type StateSpec } from './index'

/**
 * The example firm's drawing files (Home B): as found in pencil on paper,
 * rewired in CAD on blueprint-deep with the pencil as a 22% ghost.
 * src/figures/firm/drawing.server.ts re-exports `firmDrawing` as `drawing`, so
 * /drawings/firm.{wide,tall}.json and firm.{family}.{rev}.still.svg prerender.
 */

export const FIRM_STATES: readonly StateSpec[] = [
  { rev: 'asFound', medium: 'pencil', ground: 'paper' },
  { rev: 'rewired', medium: 'cad', ground: 'deep', ghost: 0.22 },
]

export const firmDrawing = graphBuilder(firmGraph, FIRM_STATES)
