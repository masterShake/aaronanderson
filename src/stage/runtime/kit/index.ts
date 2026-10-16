/**
 * The whole kit. The runtime keeps a reference to this namespace, so every
 * kit module (and the Line2 family it imports) lands in the runtime group
 * chunk, and each scene chunk carries only its own code (≤6 KB gzip).
 */
export * as rig from './rig'
export * as lines from './lines'
export * as extrude from './extrude'
export * as pipes from './pipes'
export * as packets from './packets'
export * as gauges from './gauges'
export * as materials from './materials'
export * as env from './env'
export * as labels from './labels'
export * as people from './people'
export * as ease from './ease'
export * as decor from './decor'
