import 'server-only'
import { firmBuilder, FIRM_STATES } from '@/drawings/render/firm'
import {
  HOME_PERSON_K,
  HOME_TALL_HIDDEN,
  HOME_WIDE_ONLY,
  homeFirmGraph,
} from '@/drawings/views/home'

/**
 * The firm drawing files served by /drawings/[file] (owner: home-about): Home
 * B's view of the example firm (src/drawings/views/home.ts), as found in pencil
 * on paper and rewired in CAD on blueprint-deep, with the firm's own finish
 * (tool glyphs, flanges, packets, people at Home's scale; src/drawings/render/firm.ts).
 */
export const drawing = firmBuilder(homeFirmGraph, FIRM_STATES, ['wide', 'tall'], {
  omit: (family, rev) =>
    family !== 'tall' ? [] : rev === 'rewired' ? HOME_TALL_HIDDEN : HOME_WIDE_ONLY,
  personK: HOME_PERSON_K,
})
