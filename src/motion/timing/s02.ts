/**
 * S-02 timing (owner: svc-a). One flat table, read by the figure's CSS (as unitless
 * --s02-* vars), its controller and the WebGL scene.
 *
 * Scrub progress p (0 to 1): the 2D phases end at handoffP (Appendix A: .44, not
 * pages-drawings' .50); the hand-off window is [handoffP, handoffP + .04]; the 3D model
 * builds over .48–.72; time loops start at motionFromP.
 *   sketch: boxes .00–.11, hand-carry line .06–.10, glyphs .10–.20, labels from .12
 *   scan .22–.34 (the pencil ghost is gone by .42) · conduits .30–.42 · flange ticks .40–.44
 *   the carrier walks .08–.22, sets the box down and steps off .23–.29
 * Loops (ms, wide family): the lead leaves the CRM at 0 at leadSpeed (units per second),
 * splits into three at the junction and arrives at each place at the same speed. On loop
 * failLoop only, the accounting copy stalls at its flange: the flange flashes twice
 * (pulseMs on, pulseMs off; never more than 2 flashes per second) and the SYNC FAILED →
 * ALERT SENT chip shows from the stall to chipTo; the copy resumes at resumeAt.
 * Below 1024 px the figure plays: the 2D phases over playMs, a holdMs rest, then loops.
 */
export const S02 = {
  handoffP: 0.44,
  motionFromP: 0.72,
  sketchA: 0,
  sketchB: 0.22,
  /** Pencil boxes: one every sketchStep, each drawn over sketchStroke. */
  sketchStep: 0.02,
  sketchStroke: 0.05,
  /** The hand-carry line, then the carrier walks it. */
  carryLineA: 0.06,
  carryLineB: 0.1,
  carryA: 0.08,
  carryB: 0.22,
  /** Each box's glyph (detail) draws after the boxes; its label follows. */
  sketchGlyph: 0.1,
  glyphStroke: 0.04,
  labelA: 0.12,
  /** The pencil ghost is gone by ghostOutB (A5: no leftovers under the finished plan). */
  ghostOutB: 0.42,
  scanA: 0.22,
  scanB: 0.34,
  conduitA: 0.3,
  conduitB: 0.42,
  flangeA: 0.4,
  flangeB: 0.44,
  /** The carrier sets the box down and steps off before the scan reaches him. */
  stepA: 0.23,
  stepB: 0.29,
  tiltA: 0.48,
  tiltB: 0.68,
  extrudeA: 0.5,
  anodizeA: 0.52,
  anodizeB: 0.64,
  liftA: 0.54,
  liftB: 0.6,
  growA: 0.56,
  growB: 0.64,
  flangeInA: 0.62,
  flangeInB: 0.66,
  lampA: 0.64,
  lampB: 0.66,
  labelsP: 0.68,
  loop: 6000,
  loops: 3,
  leadSpeed: 264,
  blinkMs: 300,
  failLoop: 3,
  pulseMs: 250,
  chipTo: 4600,
  reseatMs: 400,
  resumeAt: 4000,
  playMs: 3000,
  holdMs: 300,
  printMs: 300,
} as const
