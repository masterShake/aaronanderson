/**
 * S-04 timing (owner: svc-b). One flat table, read by the figure's CSS (as unitless
 * --s04-* vars) and its controller.
 *
 * Scrub progress p: the 2D phases end at handoffP (.50); time loops start at motionFromP.
 *   sketch: the five pencil tiles at ±12° are already drawn at p = 0 (their draw-on
 *   windows end before 0, so the figure never enters as an empty panel) · lock .04–.30
 *   (tiles square up into the grid, machine ease) · scan .20–.36 (paper to deep, pencil to
 *   ghost; the ghost is gone by .40) · the data store and its risers draw .22–.36, under
 *   the scan, so the panel never stands over an empty floor · the panel names fade in
 *   .36–.42, after what they name
 * Loops (ms): packets rise up the risers from 0, one every packetEvery, until packetsTo;
 * the needles settle on their end readings (S04_END: CHECK, IN RANGE, LOW) at settleAt
 * (needleMs, settle ease); in the first loop the owner's report slides out of the printer
 * slot over cardA–cardB, over the last printed page, and stays out. Three loops, then idle
 * with Run again.
 * Question chips answer at once (no typewriter) and move one needle (needleMs).
 * WebGL (optional, behind SHIP.s04): hand-off in [.50, .54]; tilt to iso .54–.74; the
 * panel slab extrudes .56–.62 and hinges hingeDeg about its south edge .60–.72; anodize
 * .58–.70; the risers grow .58–.66; the bezels settle in .66–.72; labels return at .72.
 * Below 1024 px the figure plays: the 2D phases over playMs, a holdMs rest, then loops.
 */
export const S04 = {
  handoffP: 0.5,
  motionFromP: 0.76,
  sketchA: -0.23,
  sketchB: 0,
  lockA: 0.04,
  lockB: 0.3,
  scanA: 0.2,
  scanB: 0.36,
  namesA: 0.36,
  namesB: 0.42,
  tankA: 0.22,
  tankB: 0.36,
  tiltA: 0.54,
  tiltB: 0.74,
  extrudeA: 0.56,
  extrudeB: 0.62,
  anodizeA: 0.58,
  anodizeB: 0.7,
  growA: 0.58,
  growB: 0.66,
  hingeA: 0.6,
  hingeB: 0.72,
  hingeDeg: 55,
  bezelA: 0.66,
  bezelB: 0.72,
  labelsP: 0.72,
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
