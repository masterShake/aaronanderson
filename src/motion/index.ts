/** The motion contract, for server and isomorphic code. Client hooks live in store.client.ts. */
export * from './timing'
export { timingCss, cssVars } from './timing-css'
export { HEAD_SCRIPT, STATE_EVENT, MOTION_KEY, TIER_KEY, SWITCH_SELECTOR } from './head-script'
export type { AeGlobal } from './head-script'
