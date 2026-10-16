/**
 * S-06 timing (owner: hero lane, which owns S-06 end to end). Progress values end in P
 * (unitless in cssVars); durations are ms.
 *   handoffP     the plan (complete from p = 0, W4b) holds until here; the WebGL hand-off
 *                window opens (Appendix B §B8)
 *   printFromP…  the svg tier cross-fades the CAD plan to the iso print
 *   motionFromP  the inspection loops start
 *   monthFromP + n × monthStepP  month n bolts on (n = 1…3: p .55, .70, .85)
 *   bandMs       one inspection sweep; loops sweeps, the flange is FIXED on the last
 *   playMs       phones and the harness: p runs 0 → 1 in this time (drivePlay)
 *   settleMs     longest wait for the Stage (ready or fallback) before p starts playing
 */
export const S06 = {
  handoffP: 0.15,
  printFromP: 0.15,
  printToP: 0.22,
  motionFromP: 0.4,
  monthFromP: 0.4,
  monthStepP: 0.15,
  bandMs: 3000,
  loops: 3,
  playMs: 7000,
  settleMs: 3000,
} as const
