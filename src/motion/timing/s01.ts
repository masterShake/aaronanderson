/**
 * S-01 timing (owner: svc-a). SVG only, so there is no hand-off. Scrubbed by scroll at
 * 1024 px and up with a fine pointer; otherwise it plays over playMs on entry and ends on
 * its still. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S01, 's01').
 *   sketch .00–.20: boxes (structure), the hand-off lines (connections), each box's glyph
 *     (detail), then its name (label)
 *   survey .20–.52: the total station and the surveyor, then the fan sweeps; each box it
 *     crosses gets a crosshair and its by-hand count
 *   clouds .52–.60: Δ1–Δ3 around the three worst; the ranked list builds beside them
 *   redraw .62–.80: the scan reveals the clean map on the deep panel; the pencil goes
 *   deliverables .82–1: the clouds rise into the list and go, then the 90-day roadmap draws
 */
export const S01 = {
  playMs: 5200,
  /** Sketch: boxes and lines draw in strokeP-wide windows, staggerP apart. */
  sketchFromP: 0,
  sketchStaggerP: 0.012,
  sketchStrokeP: 0.05,
  /** Glyphs (detail) after the boxes and lines; each tool's name follows its glyph. */
  glyphFromP: 0.1,
  glyphStepP: 0.01,
  glyphP: 0.03,
  labelLagP: 0.02,
  /**
   * The starting sketch (boxes, lines, glyphs, names) ends here. It draws on max(p, pre ×
   * leadP), where pre is the lead-in as the figure scrolls in, so p = 0 already shows it whole.
   */
  leadP: 0.22,
  /** Survey: the instrument draws, then the fan sweeps; each crossed box gets a crosshair and a tag. */
  surveyFromP: 0.2,
  sweepFromP: 0.26,
  sweepToP: 0.52,
  popP: 0.012,
  cloudsFromP: 0.52,
  cloudsToP: 0.6,
  /** Redraw: the scan bar reveals the clean map on the deep panel; the pencil sketch goes. */
  scanFromP: 0.62,
  scanToP: 0.8,
  /** The ranked list builds as the clouds go up: its head, then one item per cloud. */
  listFromP: 0.52,
  listToP: 0.55,
  itemFromP: 0.55,
  itemStepP: 0.027,
  itemP: 0.022,
  /** Once the map is clean, the clouds rise into the list and go; then the roadmap draws. */
  riseFromP: 0.82,
  riseToP: 0.86,
  roadmapFromP: 0.86,
  roadmapToP: 0.97,
} as const
