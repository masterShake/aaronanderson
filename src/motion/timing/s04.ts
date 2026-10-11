/**
 * S-04 timing (owner: scenes-a). One flat table, read by the figure's CSS (as unitless
 * --s04-* vars) and its controller.
 *
 * Scrub progress p: the 2D phases end at handoffP (.50); time loops start at motionFromP.
 *   sketch .00–.25 (five pencil tiles at ±12°) · lock .25–.44 (tiles square up into the
 *   grid, machine ease) · scan .30–.42 (paper to deep, pencil to ghost) · the panel names
 *   fade in .42–.48 · the data store and its risers draw .42–.50
 * Loops (ms): packets rise up the risers from 0, one every packetEvery, until packetsTo;
 * the needles settle into IN RANGE at settleAt (needleMs, settle ease); the owner's report
 * slides out of the printer slot over cardA–cardB. Three loops, then idle with Run again.
 * Question chips answer at once (no typewriter) and move one needle (needleMs).
 * Below 1024 px the figure plays: the 2D phases over playMs, a holdMs rest, then loops.
 */
export const S04 = {
  handoffP: 0.5,
  motionFromP: 0.76,
  sketchA: 0,
  sketchB: 0.25,
  lockA: 0.25,
  lockB: 0.44,
  scanA: 0.3,
  scanB: 0.42,
  namesA: 0.42,
  namesB: 0.48,
  tankA: 0.42,
  tankB: 0.5,
  loop: 6000,
  loops: 3,
  riseSpeed: 216,
  packetEvery: 300,
  packetsTo: 1800,
  settleAt: 1800,
  needleMs: 600,
  cardA: 3600,
  cardB: 4800,
  playMs: 3000,
  holdMs: 300,
} as const
