/**
 * S-05 timing (owner: services). Paper only; plays once, no loop. Scrubbed by
 * scroll at 1024 px and up with a fine pointer; otherwise it plays over playMs
 * on entry. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S05, 's05'); the beats follow pages-drawings §6.5, with a hold of
 * about 400 ms (at playMs) after the sketch and after the hand-out.
 */
export const S05 = {
  playMs: 6000,
  /** Sketch: the ground line, then the three people and their question bubbles. */
  sketchFromP: 0,
  sketchStepP: 0.05,
  sketchStrokeP: 0.08,
  /** Hand out: each tool draws in a toolP window, handStepP apart; its leader, callout and tick follow. */
  handFromP: 0.3,
  handStepP: 0.09,
  toolP: 0.05,
  calloutP: 0.03,
  /** The desk and its monitor draw, then the new hire walks in. */
  deskFromP: 0.62,
  deskToP: 0.7,
  walkFromP: 0.66,
  walkToP: 0.76,
  /** The walkthrough plays on the monitor (checklist rows, progress bar); the record ticks. */
  screenFromP: 0.78,
  screenToP: 0.9,
  recordFromP: 0.9,
  recordStepP: 0.025,
} as const
