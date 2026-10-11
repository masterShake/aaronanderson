import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The after-contact drawing files served by /drawings/[file] (owner: contact). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No after-contact drawing file ${file} yet`)
  },
}
