import type { SceneId } from './types'

/**
 * Ship gates. A scene marked 'svg' never registers 3D: its SVG print ships for
 * everyone. Only the integrators and the final check edit this file, after the
 * scene's quality gate (seam, smoothness, chunk size, robustness, cost, craft).
 * S-04 and S-06 WebGL are optional last milestones, so they start as 'svg' and
 * are promoted only when their gate passes. Outside production, the stage host
 * also honours ?ship=<sceneId> (or ?ship=all) so a lane can work on a scene
 * that is still marked 'svg' here.
 */
export const SHIP: Readonly<Record<SceneId, 'webgl' | 'svg'>> = {
  hero: 'webgl',
  s02: 'webgl',
  s03: 'svg',
  s04: 'svg',
  s06: 'svg',
}

/**
 * 'auto': phones build the hero's 3D once it is 30% visible after load.
 * 'deferred': phones keep the SVG hero; set when the 3D TBT delta exceeds 50 ms
 * or the perf gate fails.
 */
export const HERO_TOUCH_3D: 'auto' | 'deferred' = 'auto'
