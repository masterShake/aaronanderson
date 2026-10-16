import 'server-only'
import { firmBuilder, FIRM_STATES } from '@/drawings/render/firm'
import { HOME_TALL_HIDDEN, homeFirmGraph } from '@/drawings/views/home'

/**
 * The firm drawing files served by /drawings/[file] (owner: home-about): Home
 * B's view of the example firm (src/drawings/views/home.ts), as found in pencil
 * on paper and rewired in CAD on blueprint-deep, with the firm's own finish
 * (tool glyphs, flanges, packets; src/drawings/render/firm.ts).
 */
export const drawing = firmBuilder(homeFirmGraph, FIRM_STATES, ['wide', 'tall'], (family, rev) =>
  family === 'tall' && rev === 'rewired' ? HOME_TALL_HIDDEN : [],
)
