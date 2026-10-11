import { OrthographicCamera, Scene } from 'three'
import type { SceneModule } from '@/stage/types'

/** The stage lane's demo scene for /kit/stage. W0 stub: build() throws, so it falls back to SVG. */
const mod: SceneModule = {
  id: '_demo',
  create(ctx) {
    const [x, y, w, h] = ctx.viewBox
    const camera = new OrthographicCamera(x, x + w, -y, -(y + h), -1000, 1000)
    return {
      three: new Scene(),
      rig: { camera, pose() {} },
      *build() {
        throw new Error('scene stub: _demo')
      },
      reset() {},
      start() {},
      update: () => ({ animating: false }),
      setPose() {},
      resize() {},
      dispose() {},
    }
  },
}

export default mod
