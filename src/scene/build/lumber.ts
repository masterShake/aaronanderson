/**
 * The framed house, drawn as two instanced meshes on one unit box: concrete (stem walls, piers) and
 * wood (everything else). With them come the sun, the sky fill and a shadow-catching ground at grade.
 * Everything lives in plan space; add `group` under ctx.root.
 *
 * Built once from the Frame. Per frame, the FramePlan writes matrices and states straight into `out`,
 * and commit() uploads only the drawn prefix.
 *
 * All three draw in the transparent pass: the ground first (−1), then concrete (0), then wood (1).
 * Lumber is transparent so members can fade in with real alpha. It still writes depth, and instances
 * are in start order, so landed members (alpha 1) draw first and render exactly.
 */
import {
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
  ShadowMaterial,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import {
  CONCRETE,
  EDGE,
  GROUND_OPACITY,
  HEMI,
  linePx,
  SHADOW,
  SUN,
  SUN_DIR,
  SUN_INTENSITY,
  toneOf,
  WOOD,
  type Look,
} from '@/lib/framing/look'
import { boxCorners, fitSunShadow } from '@/lib/framing/shadow'
import type { Frame, FramePlan, PoseCounts, PoseOut } from '@/lib/framing/types'
import { PALETTE } from '@/lib/plan/pens'
import type { Layout } from '@/scene/camera'
import { LumberDepthMaterial } from '@/scene/materials/LumberDepthMaterial'
import { createLumberShared, LumberMaterial } from '@/scene/materials/LumberMaterial'

export interface LumberLayer {
  /** Add under ctx.root (plan space): the meshes, the ground, the sun and its target, and the sky light. */
  group: Group
  /** Aliases of the instance attribute arrays, in draw order. The FramePlan writes into these. */
  out: PoseOut
  /** Ground shadow strength, 0..1. */
  setGround(k: number): void
  /** Draw the first `counts` instances of each mesh and upload just those; re-render the shadow map. */
  commit(counts: PoseCounts): void
  /** Edge widths follow the device pixel ratio. */
  resize(layout: Layout): void
  /**
   * Precompile the program the stage's compileAsync can't reach: the shadow pass's depth program.
   * Call it once `group` is in `scene`, because the program key counts the scene's lights. It never
   * rejects.
   */
  warm(camera: Camera, scene: Scene): Promise<void>
  dispose(): void
}

/** The ground plane's side in inches: far past any shadow the house can cast. */
const GROUND_SIZE = 2400

interface Batch {
  mesh: InstancedMesh<BufferGeometry, LumberMaterial>
  matrix: Float32Array
  state: InstancedBufferAttribute
  stateArray: Float32Array
  capacity: number
}

export function buildLumber(renderer: WebGLRenderer, frame: Frame, order: FramePlan['order']): LumberLayer {
  const group = new Group()
  group.name = 'lumber'
  // One box for both meshes: index, position and normal upload once. No groups, so each mesh is one draw.
  const box = new BoxGeometry(1, 1, 1)
  const shared = createLumberShared()
  const depth = new LumberDepthMaterial()

  const batch = (name: string, ids: Int32Array, look: Look, renderOrder: number): Batch => {
    const capacity = ids.length
    const matrix = new Float32Array(capacity * 16)
    const stateArray = new Float32Array(capacity * 4)
    const state = new InstancedBufferAttribute(stateArray, 4).setUsage(DynamicDrawUsage)
    const tone = new Float32Array(capacity * 3)
    ids.forEach((m, i) => tone.set(toneOf(frame.members[m]), i * 3))

    const geometry = new BufferGeometry()
    geometry.setIndex(box.index)
    geometry.setAttribute('position', box.getAttribute('position'))
    geometry.setAttribute('normal', box.getAttribute('normal'))
    geometry.setAttribute('aState', state)

    const mesh = new InstancedMesh(geometry, new LumberMaterial(look, shared), capacity)
    mesh.instanceMatrix = new InstancedBufferAttribute(matrix, 16).setUsage(DynamicDrawUsage)
    mesh.instanceColor = new InstancedBufferAttribute(tone, 3)
    mesh.customDepthMaterial = depth
    mesh.name = name
    mesh.renderOrder = renderOrder
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Instances move, so a bounding sphere would go stale.
    mesh.frustumCulled = false
    mesh.count = 0
    mesh.visible = false
    return { mesh, matrix, state, stateArray, capacity }
  }
  const concrete = batch('lumber:concrete', order.concrete, CONCRETE, 0)
  const wood = batch('lumber:wood', order.wood, WOOD, 1)

  const grade = frame.datums.grade ?? frame.bounds[0][2]

  // three reads a hemisphere light's up from its position. Under the root, plan +Z is world up.
  const sky = new HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity)
  sky.name = 'lumber:sky'
  sky.position.set(0, 0, 1)

  const fit = fitSunShadow(boxCorners(frame.bounds), SUN_DIR, SHADOW.margin, grade)
  const sun = new DirectionalLight(SUN.color, SUN_INTENSITY)
  sun.name = 'lumber:sun'
  sun.position.set(...fit.position)
  sun.target.position.set(...fit.target)
  sun.castShadow = true
  const { shadow } = sun
  shadow.mapSize.set(SHADOW.mapSize, SHADOW.mapSize)
  shadow.radius = SHADOW.radius
  shadow.normalBias = SHADOW.normalBias
  shadow.bias = SHADOW.bias
  Object.assign(shadow.camera, {
    left: fit.left,
    right: fit.right,
    bottom: fit.bottom,
    top: fit.top,
    near: fit.near,
    far: fit.far,
  })
  shadow.camera.updateProjectionMatrix()

  // Adds ink-coloured alpha only where shadowed. It is one layer and writes no depth, so nothing doubles.
  const groundMaterial = new ShadowMaterial({ color: PALETTE.ink, opacity: 0, depthWrite: false, toneMapped: false })
  const ground = new Mesh(new PlaneGeometry(GROUND_SIZE, GROUND_SIZE), groundMaterial)
  ground.name = 'lumber:ground'
  ground.position.set(fit.target[0], fit.target[1], grade)
  ground.receiveShadow = true
  ground.renderOrder = -1
  ground.frustumCulled = false
  ground.visible = false

  group.add(concrete.mesh, wood.mesh, ground, sky, sun, sun.target)

  const out: PoseOut = {
    wood: { matrix: wood.matrix, state: wood.stateArray },
    concrete: { matrix: concrete.matrix, state: concrete.stateArray },
  }

  const upload = (b: Batch, n: number) => {
    const count = Math.min(Math.max(0, n), b.capacity)
    b.mesh.count = count
    b.mesh.visible = count > 0
    for (const [attr, size] of [
      [b.mesh.instanceMatrix, 16],
      [b.state, 4],
    ] as const) {
      attr.clearUpdateRanges()
      if (!count) continue
      attr.addUpdateRange(0, count * size)
      attr.needsUpdate = true
    }
  }

  let disposed = false

  return {
    group,
    out,
    setGround(k) {
      const v = Math.min(1, Math.max(0, k))
      groundMaterial.opacity = GROUND_OPACITY * v
      ground.visible = v > 0
    },
    commit(counts) {
      upload(concrete, counts.concrete)
      upload(wood, counts.wood)
      // Read fresh: a context restore replaces the shadowMap object.
      renderer.shadowMap.needsUpdate = true
    },
    resize(layout) {
      shared.linePx.value = linePx(EDGE.px, layout.dpr)
      shared.aiLinePx.value = linePx(EDGE.aiPx, layout.dpr)
    },
    async warm(camera, scene) {
      if (disposed) return
      // compileAsync only compiles object.material, never customDepthMaterial, so compile the depth
      // program through a proxy whose material it is. It must match the shadow pass's program key:
      // - Instanced, with instanceColor, as the real meshes are.
      // - Compiled under a render target. The shadow pass renders into the shadow map, so its programs
      //   use the working (linear) colour space rather than the canvas's sRGB.
      // - Lit by the target scene's lights, because the key counts lights even for depth programs.
      const proxy = new InstancedMesh(wood.mesh.geometry, depth, 1)
      proxy.instanceColor = new InstancedBufferAttribute(new Float32Array(3), 3)
      const target = new WebGLRenderTarget(1, 1)
      const prev = [renderer.getRenderTarget(), renderer.getActiveCubeFace(), renderer.getActiveMipmapLevel()] as const
      try {
        let done: Promise<unknown>
        renderer.setRenderTarget(target)
        try {
          done = renderer.compileAsync(proxy, camera, scene)
        } finally {
          renderer.setRenderTarget(...prev)
        }
        await done
      } catch {
        // A lost context, say: the shadow pass compiles the program on first use instead.
      } finally {
        target.dispose()
        proxy.dispose()
      }
    },
    dispose() {
      disposed = true
      group.removeFromParent()
      for (const b of [concrete, wood]) {
        b.mesh.dispose()
        b.mesh.geometry.dispose()
        b.mesh.material.dispose()
      }
      box.dispose()
      depth.dispose()
      ground.geometry.dispose()
      groundMaterial.dispose()
      // Frees the shadow map.
      sun.dispose()
      sky.dispose()
    },
  }
}
