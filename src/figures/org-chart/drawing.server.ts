import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The org-chart drawing files served by /drawings/[file] (owner: home-about). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No org-chart drawing file ${file} yet`)
  },
}
