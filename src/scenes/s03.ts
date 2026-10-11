import { OrthographicCamera, Scene } from 'three'
import type { SceneModule } from '@/stage/types'

/** Scene stub (owner: scenes-b). build() throws, so the Stage falls back and the figure stays SVG. */
const mod: SceneModule = {
  id: 's03',
  create(ctx) {
    const [x, y, w, h] = ctx.viewBox
    const camera = new OrthographicCamera(x, x + w, -y, -(y + h), -1000, 1000)
    return {
      three: new Scene(),
      rig: { camera, pose() {} },
      *build() {
        throw new Error('scene stub: s03')
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
