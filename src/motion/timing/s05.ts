/**
 * S-05 timing (owner: services). Paper only; plays once, no loop. Scrubbed by
 * scroll at 1024 px and up with a fine pointer; otherwise it plays over playMs
 * on entry. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S05, 's05'); the beats follow pages-drawings §6.5.
 */
export const S05 = {
  playMs: 3400,
  /** Sketch: the ground line, then the three people and their question marks. */
  sketchFromP: 0,
  sketchStepP: 0.07,
  sketchStrokeP: 0.08,
  /** Hand out: each tool draws in a toolP window, handStepP apart; its callout and tick follow. */
  handFromP: 0.3,
  handStepP: 0.11,
  toolP: 0.06,
  calloutP: 0.03,
  /** New hire: walks in, the walkthrough plays on the screen, the training record ticks. */
  walkFromP: 0.65,
  walkToP: 0.78,
  screenFromP: 0.78,
  screenToP: 0.92,
  recordFromP: 0.92,
  recordStepP: 0.02,
} as const
