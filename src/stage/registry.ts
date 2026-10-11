import type { DevSceneId, SceneId, SceneModule } from './types'

/**
 * Scene chunks, one async import each, so a route only pays for the scenes it
 * shows. Imported only by src/stage/runtime/**. Frozen after W0.
 */
export const SCENES: Readonly<Record<SceneId, () => Promise<{ default: SceneModule }>>> = {
  hero: () => import('@/scenes/hero'),
  s02: () => import('@/scenes/s02'),
  s03: () => import('@/scenes/s03'),
  s04: () => import('@/scenes/s04'),
  s06: () => import('@/scenes/s06'),
}

/** Preview-only scenes, for /kit/stage. */
export const DEV_SCENES: Readonly<Record<DevSceneId, () => Promise<{ default: SceneModule }>>> = {
  _demo: () => import('@/scenes/_demo'),
  _probe: () => import('@/scenes/_probe'),
}
