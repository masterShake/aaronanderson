/**
 * S-06 timing (owner: hero lane, which owns S-06 end to end). Progress values end in P
 * (unitless in cssVars); durations are ms.
 *   handoffP     the plan (complete from p = 0, W4b) holds until here; the WebGL hand-off
 *                window opens (Appendix B §B8)
 *   printFromP…  the svg tier cross-fades the CAD plan to the iso print; it starts after the
 *                hand-off window (W4c), so the print never ghosts over the plan while the
 *                Stage takes over, and the model starts to rise as the plan names leave
 *   motionFromP  the inspection loops start
 *   monthFromP + n × monthStepP  month n bolts on (n = 1…3: p .55, .70, .85)
 *   bandMs       one inspection sweep; loops sweeps, the flange is FIXED on the last
 *   playMs       phones and the harness: p runs 0 → 1 in this time (drivePlay)
 *   settleMs     longest wait for the Stage (ready or fallback) before p starts playing
 *   hotP         a month's instrument lands orange and holds for this much p, then settles to
 *                aluminum over coolP (W4c: the owner's report is the one constant orange)
 *   isoPad       the iso end pose's margin (fraction of the box per side): the print, its
 *                labels and the WebGL rig all fit the model with it, so they still match
 */
export const S06 = {
  handoffP: 0.15,
  printFromP: 0.19,
  printToP: 0.26,
  motionFromP: 0.4,
  monthFromP: 0.4,
  monthStepP: 0.15,
  bandMs: 3000,
  loops: 3,
  playMs: 7000,
  settleMs: 3000,
  hotP: 0.08,
  coolP: 0.03,
  isoPad: 0.025,
} as const
