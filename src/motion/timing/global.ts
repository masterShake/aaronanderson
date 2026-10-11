/**
 * Every shared motion number on the site. Frozen after W0. CSS reads the same
 * values through <style id="ae-timing"> (timing-css.ts), so nothing else may
 * declare --dur-*, --ease-* or --flow-*. Durations are in ms.
 */

export const EASE = {
  pencil: 'cubic-bezier(.33,0,.2,1)',
  machine: 'cubic-bezier(.65,0,.35,1)',
  settle: 'cubic-bezier(.16,1,.3,1)',
  ui: 'cubic-bezier(.2,0,0,1)',
  flow: 'linear',
} as const

export const DUR = {
  micro: 120,
  ui: 200,
  sheet: 420,
  sheetOut: 150,
  state: 900,
  scan: 1200,
  tilt: 1600,
  handoff: 120,
  fadeBack: 200,
  svgToPrint: 300,
  stamp: 240,
  copied: 1600,
} as const

/** Pencil draw-on: stroke lengths, stagger and seeded jitter; ghost is the erased opacity. */
export const PENCIL = {
  strokeMin: 240,
  strokeMax: 380,
  staggerMin: 45,
  staggerMax: 70,
  jitter: 30,
  note: 260,
  pop: 160,
  ghost: 0.22,
} as const

/** Data moves linearly at a constant speed (user units per second). Loops run 3 times, then idle. */
export const FLOW = {
  speed: 140,
  loop: 6000,
  loops: 3,
  packetEvery: 750,
  outOfToleranceEvery: 4,
  maxFlashesPerSecond: 2,
} as const

/** Visibility ratios and the CSS fallback that starts the hero if no script armed it. */
export const GATE = {
  entry: 0.4,
  offscreen: 0.1,
  stepLine: 0.55,
  handoffVisible: 0.5,
  handoffDeadline: 9000,
  cssAutoStart: 4000,
} as const

/** When 3D and drawings load. */
export const LOAD = {
  idleTimeout: 2000,
  mobileVisible: 0.3,
  nearViewports: 1,
  schedulerSlow: 8000,
} as const

/** Frame guard: skip 5 frames, then take the median of the next 60 (frames 6 to 65). */
export const GUARD = { skip: 5, samples: 60, medianMs: 20 } as const

/** RoomEnvironment PMREM: built once per session at size 128, or 64 if 3d:env is slow. */
export const ENV = { size: 128, fallbackSize: 64, slowMs: 80 } as const

/** Scrub hand-off window width and hand-back hysteresis (Appendix B §B8). */
export const SCRUB = { handoffWindow: 0.04, handbackBelow: 0.01, handbackSmoothed: 0.005 } as const
