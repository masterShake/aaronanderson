import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The s02 drawing files served by /drawings/[file] (owner: scenes-a). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No s02 drawing file ${file} yet`)
  },
}
