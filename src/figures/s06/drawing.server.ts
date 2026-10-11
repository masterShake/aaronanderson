import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The s06 drawing files served by /drawings/[file] (owner: hero). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No s06 drawing file ${file} yet`)
  },
}
