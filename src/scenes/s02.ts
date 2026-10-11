import { OrthographicCamera, Scene } from 'three'
import type { SceneModule } from '@/stage/types'

/** Scene stub (owner: scenes-a). build() throws, so the Stage falls back and the figure stays SVG. */
const mod: SceneModule = {
  id: 's02',
  create(ctx) {
    const [x, y, w, h] = ctx.viewBox
    const camera = new OrthographicCamera(x, x + w, -y, -(y + h), -1000, 1000)
    return {
      three: new Scene(),
      rig: { camera, pose() {} },
      *build() {
        throw new Error('scene stub: s02')
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
