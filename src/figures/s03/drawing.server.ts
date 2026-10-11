import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The s03 drawing files served by /drawings/[file] (owner: scenes-b). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No s03 drawing file ${file} yet`)
  },
}
