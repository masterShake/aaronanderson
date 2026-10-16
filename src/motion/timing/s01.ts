/**
 * S-01 timing (owner: svc-a). SVG only, so there is no hand-off. Scrubbed by scroll at
 * 1024 px and up with a fine pointer; otherwise it plays over playMs on entry and ends on
 * its still. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S01, 's01').
 *   sketch .00–.22: boxes (structure), the hand-off lines (connections), each box's glyph
 *     (detail), then its name (label); the total station and the surveyor set up .14–.20.
 *     All of it draws on the lead-in too, so p = 0 already shows it whole (W4b)
 *   survey .26–.52: the fan sweeps; each box it crosses gets a crosshair and its by-hand
 *     count, and the ranked list builds in the column beside it (.28–.48), so the column
 *     under the surveyor is not left empty for half the scrub
 *   clouds .52–.60: Δ1–Δ3 around the three worst
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
  /**
   * Survey: the instrument and the surveyor draw (with the sketch, inside leadP), then the
   * fan sweeps; each crossed box gets a crosshair and a tag.
   */
  surveyFromP: 0.14,
  surveyToP: 0.2,
  sweepFromP: 0.26,
  sweepToP: 0.52,
  popP: 0.012,
  cloudsFromP: 0.52,
  cloudsToP: 0.6,
  /** Redraw: the scan bar reveals the clean map on the deep panel; the pencil sketch goes. */
  scanFromP: 0.62,
  scanToP: 0.8,
  /** The ranked list builds while the fan sweeps: its head, then one item at a time. */
  listFromP: 0.28,
  listToP: 0.31,
  itemFromP: 0.31,
  itemStepP: 0.075,
  itemP: 0.022,
  /** Once the map is clean, the clouds rise into the list and go; then the roadmap draws. */
  riseFromP: 0.82,
  riseToP: 0.86,
  roadmapFromP: 0.86,
  roadmapToP: 0.97,
} as const
