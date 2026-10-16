/**
 * S-01 timing (owner: svc-a). SVG only, so there is no hand-off. Scrubbed by scroll at
 * 1024 px and up with a fine pointer; otherwise it plays over playMs on entry and ends on
 * its still. Keys ending in P are figure progress (0 to 1) and stay unitless in
 * cssVars(S01, 's01').
 *   sketch .00–.22: boxes (structure), the hand-off lines (connections), each box's glyph
 *     (detail), then its name (label); the total station and the surveyor set up .14–.20,
 *     and the blank survey sheet beside them (the ruled WHAT TO FIX FIRST list and the
 *     90-day dimension string) .16–.22. All of it draws on the lead-in too, so p = 0
 *     already shows it whole, with no empty column (W4b, W4c)
 *   survey .06–.40: the fan sweeps; each box it crosses gets a crosshair and its by-hand
 *     count, and the ranked list's rows are written in as it goes (.14–.36)
 *   clouds .40–.48: Δ1–Δ3 around the three worst
 *   redraw .50–.70: the scan reveals the clean map on the deep panel; the pencil goes
 *   deliverables .72–.90: the clouds rise into the list and go, then the 90-day roadmap is
 *     inked with its three steps; the finished sheet holds from .90
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
   * The starting sketch (boxes, lines, glyphs, names, the surveyor and the blank sheet) ends
   * here. It draws on max(p, pre × leadP), where pre is the lead-in as the figure scrolls in,
   * so p = 0 already shows it whole.
   */
  leadP: 0.22,
  /**
   * Survey: the instrument and the surveyor draw (with the sketch, inside leadP), then the
   * fan sweeps; each crossed box gets a crosshair and a tag.
   */
  surveyFromP: 0.14,
  surveyToP: 0.2,
  sweepFromP: 0.06,
  sweepToP: 0.4,
  popP: 0.012,
  cloudsFromP: 0.4,
  cloudsToP: 0.48,
  /** Redraw: the scan bar reveals the clean map on the deep panel; the pencil sketch goes. */
  scanFromP: 0.5,
  scanToP: 0.7,
  /** The blank sheet (ruled list, dimension string) sets up with the surveyor, on the lead-in. */
  listFromP: 0.16,
  listToP: 0.22,
  /** Its rows are written in while the fan sweeps, one at a time. */
  itemFromP: 0.14,
  itemStepP: 0.1,
  itemP: 0.022,
  /** Once the map is clean, the clouds rise into the list and go; then the roadmap is inked. */
  riseFromP: 0.72,
  riseToP: 0.76,
  roadmapFromP: 0.76,
  roadmapToP: 0.9,
} as const
