import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'

/** The ticket drawing files served by /drawings/[file] (owner: how). W0: none yet. */
export const drawing: DrawingBuilder = {
  files: [],
  build(file) {
    throw new Error(`No ticket drawing file ${file} yet`)
  },
}
