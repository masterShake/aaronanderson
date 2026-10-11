import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The s05 drawing files served by /drawings/[file] (owner: services). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No s05 drawing file ${file} yet`)
  },
}
