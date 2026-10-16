/**
 * S-05 timing (owner: services). Paper only; plays once, no loop. Scrubbed by
 * scroll at 1024 px and up with a fine pointer; otherwise it plays over playMs
 * on entry. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S05, 's05'); the beats follow pages-drawings §6.5.
 *
 * The starting drawing is complete at p = 0 (W4b: a figure never enters as an
 * empty panel): the ground, the crew with their question bubbles, and the desk
 * with its monitor are already drawn. It holds about 500 ms (at playMs) before
 * the hand-out, and about 400 ms after it.
 */
export const S05 = {
  playMs: 6000,
  /** Hand out: each tool draws in a toolP window, handStepP apart; its leader, callout and tick follow. */
  handFromP: 0.08,
  handStepP: 0.12,
  toolP: 0.06,
  calloutP: 0.04,
  /** The new hire walks in to the desk (it is drawn from the start). */
  walkFromP: 0.54,
  walkToP: 0.68,
  /** The walkthrough plays on the monitor (checklist rows, progress bar); the record ticks. */
  screenFromP: 0.72,
  screenToP: 0.86,
  recordFromP: 0.87,
  recordStepP: 0.025,
} as const
