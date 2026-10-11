/**
 * S-01 timing (owner: services). SVG only, so there is no hand-off. Scrubbed by
 * scroll at 1024 px and up with a fine pointer; otherwise it plays over playMs
 * on entry. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S01, 's01'); the beats follow pages-drawings §6.1.
 */
export const S01 = {
  playMs: 3400,
  /** Sketch: boxes and lines draw in strokeP-wide windows, staggerP apart. */
  sketchFromP: 0,
  sketchStaggerP: 0.015,
  sketchStrokeP: 0.05,
  notesFromP: 0.2,
  notesToP: 0.28,
  /** Survey: the instrument draws, then the fan sweeps; each crossed box gets a crosshair and a tag. */
  surveyFromP: 0.3,
  sweepFromP: 0.34,
  sweepToP: 0.58,
  popP: 0.012,
  cloudsFromP: 0.52,
  cloudsToP: 0.6,
  /** Redraw: the scan bar reveals the clean map on the deep panel; the pencil becomes a ghost. */
  scanFromP: 0.6,
  scanToP: 0.8,
  /** Deliverables: clouds rise into the ranked list; then the roadmap draws. */
  riseFromP: 0.85,
  riseToP: 0.89,
  itemFromP: 0.88,
  itemStepP: 0.02,
  itemP: 0.02,
  roadmapFromP: 0.93,
  roadmapToP: 0.99,
} as const
