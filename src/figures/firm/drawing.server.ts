import 'server-only'
import { graphBuilder } from '@/drawings/render'
import { FIRM_STATES } from '@/drawings/render/firm'
import { homeFirmGraph } from '@/drawings/views/home'

/**
 * The firm drawing files served by /drawings/[file] (owner: home-about): Home
 * B's view of the example firm (src/drawings/views/home.ts), as found in pencil
 * on paper and rewired in CAD on blueprint-deep with the pencil as a ghost.
 */
export const drawing = graphBuilder(homeFirmGraph, FIRM_STATES)
