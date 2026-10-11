import {
  HalfFloatType,
  PerspectiveCamera,
  PMREMGenerator,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { yieldToMain } from '@/motion/visibility'
import { ENV } from '@/motion/timing/global'
import { MARK } from '../../types'

/**
 * The session's one environment: RoomEnvironment through PMREM (D9, §2.8).
 * compileAsync precompiles the room's materials into a throwaway target with
 * the capture's program keys (linear, no tone mapping), then one fromScene
 * runs at ENV.size (128). The perf gate measures `3d:env`; over ENV.slowMs at
 * 4× CPU, ENV.size becomes ENV.fallbackSize (64). Session-scoped: never rebuilt.
 */
export async function buildEnv(
  renderer: WebGLRenderer,
  size: number = ENV.size,
): Promise<{ target: WebGLRenderTarget; ms: number }> {
  const room = new RoomEnvironment()
  const rt0 = new WebGLRenderTarget(16, 16, { type: HalfFloatType })
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt0)
  try {
    await renderer.compileAsync(room, new PerspectiveCamera(90, 1, 0.1, 100))
  } finally {
    renderer.setRenderTarget(prev)
    rt0.dispose()
  }
  await yieldToMain()
  const t0 = performance.now()
  const pmrem = new PMREMGenerator(renderer)
  const target = pmrem.fromScene(room, 0, 0.1, 100, { size })
  pmrem.dispose()
  room.dispose()
  const ms = performance.now() - t0
  performance.measure(MARK.env, { start: t0, duration: ms })
  return { target, ms }
}
