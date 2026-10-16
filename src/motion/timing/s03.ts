/**
 * S-03 timing (owner: scenes-b). Hands off from the front elevation, section A–A.
 * Keys ending in P are scrub progress (unitless in CSS); the rest are ms. FigureFrame
 * gets cssVars(S03, 's03'), so CSS reads the same numbers (--s03-handoff-p, --s03-feed-ms…).
 *
 * 2D phases end at handoffP: pencil sketch, the section line A–A drops in, the scan
 * turns the sheet into a section on blueprint, then the internals draw on. WebGL owns
 * [handoffP + .04, motionFromP]; the batch starts once at motionFromP and stops at
 * HELD FOR APPROVAL until the visitor approves.
 */
export const S03 = {
  handoffP: 0.38,
  motionFromP: 0.62,
  sketchFromP: 0.01,
  sketchToP: 0.18,
  cutFromP: 0.17,
  cutToP: 0.22,
  scanFromP: 0.21,
  scanToP: 0.31,
  detailFromP: 0.27,
  detailToP: 0.37,
  /** Labels (and their leaders) come after the details they name. */
  labelsFromP: 0.355,
  /** Pencil and detail draw-on: each stroke's window, and the stagger per element (--i). */
  strokeP: 0.035,
  sketchStaggerP: 0.015,
  detailStaggerP: 0.012,
  /** WebGL: extrude, anodize, tilt (front → three-quarter). */
  extrudeFromP: 0.42,
  extrudeToP: 0.54,
  anodizeFromP: 0.46,
  anodizeToP: 0.56,
  tiltToP: 0.6,
  /** Play mode (below 1024 px): the 2D phases, then the batch. */
  playMs: 3000,
  /** One document: drop and feed, read, then out to the tray (or the gate and the chute). */
  feedMs: 800,
  readMs: 500,
  outMs: 500,
  gateMs: 300,
  dropMs: 600,
  /** Approve: the stamp lands, then the third card slides out. */
  stampMs: 240,
  approveMs: 900,
} as const

/** The three-quarter end pose, degrees (kept out of S03 so cssVars never suffixes them). */
export const S03_POSE = { azDeg: 32, elDeg: 20 } as const

/** One document's whole pass, ms. */
export const S03_DOC_MS = S03.feedMs + S03.readMs + S03.outMs
/** The batch, from its start to HELD, ms (two documents through, the third held). */
export const S03_HELD_MS = 2 * S03_DOC_MS + S03.feedMs + S03.readMs + S03.gateMs + S03.dropMs
