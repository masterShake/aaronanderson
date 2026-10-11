import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The s04 drawing files served by /drawings/[file] (owner: scenes-a). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No s04 drawing file ${file} yet`)
  },
}
