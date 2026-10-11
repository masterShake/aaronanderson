import { S02 } from './s02'
import { S03 } from './s03'
import { S04 } from './s04'
import { S06 } from './s06'

/** Every timing table, from one import. Frozen after W0; each figure file has its owner. */
export * from './global'
export * from './hero'
export * from './s01'
export * from './s02'
export * from './s03'
export * from './s04'
export * from './s05'
export * from './s06'
export * from './ticket'

/** Scrub progress at which each WebGL service scene hands off (2D phases end here). */
export const HANDOFF_P = {
  s02: S02.handoffP,
  s03: S03.handoffP,
  s04: S04.handoffP,
  s06: S06.handoffP,
} as const

/** Scrub progress at which each service scene's mechanism starts moving. */
export const MOTION_FROM_P = {
  s02: S02.motionFromP,
  s03: S03.motionFromP,
  s04: S04.motionFromP,
  s06: S06.motionFromP,
} as const
