import {
  BackSide,
  BasicDepthPacking,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  FrontSide,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderLib,
  ShadowMaterial,
  UniformsUtils,
  Vector3,
  WebGLRenderTarget,
  type Material,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CONCRETE, GROUND_OPACITY, SHADOW, SUN_DIR, SUN_INTENSITY, toneOf, WOOD } from '@/lib/framing/look'
import { boxCorners, fitSunShadow, onGround } from '@/lib/framing/shadow'
import type { Frame, Member, Vec3 } from '@/lib/framing/types'
import { buildLumber } from '@/scene/build/lumber'
import { createHouseRoot, planToWorld } from '@/scene/coords'
import { inject } from '@/scene/materials/inject'
import {
  LUMBER_DEPTH_PROGRAM,
  LumberDepthMaterial,
  patchDepthFragment,
  patchDepthVertex,
} from '@/scene/materials/LumberDepthMaterial'
import {
  createLumberShared,
  LUMBER_PROGRAM,
  LumberMaterial,
  patchLumberFragment,
  patchLumberVertex,
} from '@/scene/materials/LumberMaterial'

const count = (src: string, s: string) => src.split(s).length - 1
const at = (src: string, s: string) => {
  const i = src.indexOf(s)
  expect(i, s).toBeGreaterThanOrEqual(0)
  return i
}

/** What three hands onBeforeCompile for a built-in material. */
const params = (id: 'lambert' | 'depth') =>
  ({
    vertexShader: ShaderLib[id].vertexShader,
    fragmentShader: ShaderLib[id].fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib[id].uniforms),
  }) as unknown as WebGLProgramParametersWithUniforms

describe('lumber materials', () => {
  it("patches the installed three's ShaderLib.lambert and ShaderLib.depth, each anchor exactly once", () => {
    const { lambert, depth } = ShaderLib
    for (const a of ['#include <common>', '#include <begin_vertex>']) {
      expect(count(lambert.vertexShader, a), a).toBe(1)
      expect(count(depth.vertexShader, a), a).toBe(1)
    }
    for (const a of ['#include <common>', '#include <color_fragment>', '#include <opaque_fragment>'])
      expect(count(lambert.fragmentShader, a), a).toBe(1)
    for (const a of ['#include <common>', '#include <clipping_planes_fragment>'])
      expect(count(depth.fragmentShader, a), a).toBe(1)
    // inject() asserts the same, so these throw if three moved an anchor.
    expect(() => patchLumberVertex(lambert.vertexShader)).not.toThrow()
    expect(() => patchLumberFragment(lambert.fragmentShader)).not.toThrow()
    expect(() => patchDepthVertex(depth.vertexShader)).not.toThrow()
    expect(() => patchDepthFragment(depth.fragmentShader)).not.toThrow()
  })

  it('declares and uses its inputs where three has them in scope', () => {
    const vs = patchLumberVertex(ShaderLib.lambert.vertexShader)
    expect(vs).toContain('attribute vec4 aState;')
    expect(vs).toContain('length( instanceMatrix[ 0 ].xyz )')
    expect(vs).toContain('vLumLocal = position * lumSize;')
    expect(at(vs, 'flat varying vec4 vLumState;')).toBeLessThan(at(vs, 'void main()'))
    expect(at(vs, 'vLumState = aState;')).toBeGreaterThan(at(vs, '#include <begin_vertex>'))
    expect(at(vs, 'vLumState = aState;')).toBeGreaterThan(at(vs, 'void main()'))

    const fs = patchLumberFragment(ShaderLib.lambert.fragmentShader)
    for (const id of [
      'uEndGrain',
      'uAI',
      'uEdgeK',
      'uLinePx',
      'uAILinePx',
      'uLod',
      'dFdx( vLumLocal )',
      'dFdy( vLumLocal )',
    ])
      expect(fs).toContain(id)
    expect(at(fs, 'flat varying vec4 vLumState;')).toBeLessThan(at(fs, 'void main()'))
    // End grain multiplies the albedo before lighting; edges and alpha come after it, before the output.
    expect(at(fs, 'uEndGrain, step(')).toBeGreaterThan(at(fs, '#include <color_fragment>'))
    expect(at(fs, 'uEndGrain, step(')).toBeLessThan(at(fs, '#include <lights_lambert_fragment>'))
    expect(at(fs, 'dFdx( vLumLocal )')).toBeGreaterThan(at(fs, 'vec3 outgoingLight ='))
    expect(at(fs, 'diffuseColor.a *= vLumState.x;')).toBeLessThan(at(fs, '#include <opaque_fragment>'))
    expect(count(fs, '#include <opaque_fragment>')).toBe(1)

    const dvs = patchDepthVertex(ShaderLib.depth.vertexShader)
    const dfs = patchDepthFragment(ShaderLib.depth.fragmentShader)
    expect(dvs).toContain('vLumAlpha = aState.x;')
    expect(at(dfs, 'discard;')).toBeGreaterThan(at(dfs, '#include <clipping_planes_fragment>'))
    expect(dfs).toContain('vLumAlpha < 1.0')
  })

  it('shares one program between wood and concrete; only their uniforms differ', () => {
    const shared = createLumberShared()
    const wood = new LumberMaterial(WOOD, shared)
    const concrete = new LumberMaterial(CONCRETE, shared)
    expect(wood.customProgramCacheKey()).toBe(LUMBER_PROGRAM)
    expect(concrete.customProgramCacheKey()).toBe(wood.customProgramCacheKey())

    const a = params('lambert')
    const b = params('lambert')
    wood.onBeforeCompile(a)
    concrete.onBeforeCompile(b)
    expect(a.vertexShader).toBe(b.vertexShader)
    expect(a.fragmentShader).toBe(b.fragmentShader)
    expect(a.uniforms.uEdgeK.value).toBe(WOOD.edge)
    expect(b.uniforms.uEdgeK.value).toBe(CONCRETE.edge)
    expect(a.uniforms.uEndGrain.value).toEqual(new Vector3(...WOOD.endGrain))
    // Shared uniforms are the same objects, so one resize sets both.
    expect(a.uniforms.uLinePx).toBe(shared.linePx)
    expect(b.uniforms.uLinePx).toBe(shared.linePx)
    expect(a.uniforms.uLod).toBe(shared.lod)
    expect((a.uniforms.uAI.value as Color).getHexString()).toBe('1f5bff')

    expect(wood.transparent).toBe(true)
    expect(wood.depthWrite).toBe(true)
    expect(wood.toneMapped).toBe(false)
    expect(wood.side).toBe(FrontSide)
    expect(wood.color.getHexString()).toBe(WOOD.albedo.slice(1))
  })

  it("matches three's own shadow depth material, flipped for FrontSide casters", () => {
    const depth = new LumberDepthMaterial()
    expect(depth.side).toBe(BackSide)
    expect(depth.depthPacking).toBe(BasicDepthPacking)
    expect(depth.alphaTest).toBe(0)
    expect(depth.map).toBeNull()
    expect(depth.customProgramCacheKey()).toBe(LUMBER_DEPTH_PROGRAM)
    const p = params('depth')
    depth.onBeforeCompile(p)
    expect(p.vertexShader).toContain('attribute vec4 aState;')
    expect(p.fragmentShader).toContain('discard;')
  })

  it('refuses a missing or repeated anchor, and inserts code verbatim', () => {
    expect(() => inject('abc', 'zzz', 'x')).toThrow()
    expect(() => inject('a;a;', 'a;', 'x')).toThrow()
    expect(inject('a;b', 'a;', 'c')).toBe('a;\ncb')
    expect(inject('a;b', 'a;', '$&', true)).toBe('$&b')
  })
})

// ── buildLumber, with a stub renderer (no WebGL context in Node) ─────────────────────────────

const member = (id: string, kind: Member['kind'], section: Member['section'], extra: Partial<Member> = {}): Member => ({
  id,
  kind,
  material: section === 'concrete' ? 'concrete' : 'wood',
  section,
  group: 'g',
  c: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  size: [96, 8, 18.5],
  ...extra,
})

const BOUNDS: Frame['bounds'] = [
  [-13, -85, -30],
  [589, 397, 213],
]

const makeFrame = (): Frame => ({
  members: [
    member('stem/s', 'stem-wall', 'concrete'),
    member('sill/s/0', 'sill', '2x6', { treated: true }),
    member('deck/0', 'subfloor', 'osb'),
  ],
  assemblies: [],
  datums: { grade: -30 },
  bounds: BOUNDS,
})

/** Draw order: the deck, then the sill (wood); the stem wall (concrete). */
const order = () => ({ wood: Int32Array.from([2, 1]), concrete: Int32Array.from([0]) })

const aState = (m: InstancedMesh) => m.geometry.getAttribute('aState') as InstancedBufferAttribute

function fixture(renderer?: object) {
  const frame = makeFrame()
  const shadowMap = { enabled: true, type: PCFShadowMap, autoUpdate: false, needsUpdate: false }
  const layer = buildLumber((renderer ?? { shadowMap }) as unknown as WebGLRenderer, frame, order())
  const get = <T>(name: string) => layer.group.getObjectByName(name) as T
  return {
    frame,
    shadowMap,
    layer,
    wood: get<InstancedMesh>('lumber:wood'),
    concrete: get<InstancedMesh>('lumber:concrete'),
    ground: get<Mesh>('lumber:ground'),
    sun: get<DirectionalLight>('lumber:sun'),
    sky: get<HemisphereLight>('lumber:sky'),
  }
}

describe('buildLumber', () => {
  it('builds both meshes empty, at capacity, with out aliasing their instance arrays', () => {
    const { layer, wood, concrete } = fixture()
    expect(layer.out.wood.matrix.length).toBe(2 * 16)
    expect(layer.out.wood.state.length).toBe(2 * 4)
    expect(layer.out.concrete.matrix.length).toBe(16)
    expect(layer.out.concrete.state.length).toBe(4)
    for (const [mesh, out, renderOrder] of [
      [wood, layer.out.wood, 1],
      [concrete, layer.out.concrete, 0],
    ] as const) {
      expect(mesh.count).toBe(0)
      expect(mesh.visible).toBe(false)
      expect(mesh.renderOrder).toBe(renderOrder)
      expect(mesh.castShadow && mesh.receiveShadow).toBe(true)
      expect(mesh.frustumCulled).toBe(false)
      expect(mesh.instanceMatrix.array).toBe(out.matrix)
      expect(aState(mesh).array).toBe(out.state)
      expect(mesh.instanceMatrix.usage).toBe(DynamicDrawUsage)
      expect(aState(mesh).usage).toBe(DynamicDrawUsage)
      expect(mesh.geometry.groups).toHaveLength(0)
      expect(mesh.customDepthMaterial).toBeInstanceOf(LumberDepthMaterial)
    }
    // One unit box under both: index, position and normal are the same attributes.
    expect(wood.geometry.index).toBe(concrete.geometry.index)
    expect(wood.geometry.getAttribute('position')).toBe(concrete.geometry.getAttribute('position'))
    expect(aState(wood)).not.toBe(aState(concrete))
    expect(wood.customDepthMaterial).toBe(concrete.customDepthMaterial)
  })

  it('tones each instance in draw order', () => {
    const { frame, wood, concrete } = fixture()
    const tones = Array.from(wood.instanceColor!.array)
    expect(tones.slice(0, 3)).toEqual(Array.from(Float32Array.from(toneOf(frame.members[2]))))
    expect(tones.slice(3, 6)).toEqual(Array.from(Float32Array.from(toneOf(frame.members[1]))))
    expect(Array.from(concrete.instanceColor!.array)).toEqual([1, 1, 1])
  })

  it('commits a prefix: count, visibility, one update range per buffer, and a shadow re-render', () => {
    const { layer, wood, concrete, shadowMap } = fixture()
    layer.out.wood.matrix.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1])
    layer.out.wood.state.set([1, 0, 0, 0])
    const v0 = [wood.instanceMatrix.version, concrete.instanceMatrix.version]
    layer.commit({ wood: 2, concrete: 0 })
    expect([wood.count, wood.visible, concrete.count, concrete.visible]).toEqual([2, true, 0, false])
    expect(wood.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 32 }])
    expect(aState(wood).updateRanges).toEqual([{ start: 0, count: 8 }])
    expect(wood.instanceMatrix.version).toBe(v0[0] + 1)
    expect(concrete.instanceMatrix.updateRanges).toEqual([])
    expect(concrete.instanceMatrix.version).toBe(v0[1])
    expect(shadowMap.needsUpdate).toBe(true)

    // Ranges are replaced, never accumulated, so an upload is always just the drawn prefix.
    layer.commit({ wood: 1, concrete: 1 })
    expect(wood.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }])
    expect(aState(wood).updateRanges).toEqual([{ start: 0, count: 4 }])
    expect(concrete.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }])
    expect(concrete.visible).toBe(true)

    // Never past capacity; an empty mesh hides and uploads nothing.
    layer.commit({ wood: 9, concrete: 0 })
    expect(wood.count).toBe(2)
    expect([concrete.count, concrete.visible]).toEqual([0, false])
    expect(concrete.instanceMatrix.updateRanges).toEqual([])
    expect(aState(concrete).updateRanges).toEqual([])
  })

  it('fades the ground shadow and sets edge widths from the pixel ratio', () => {
    const { layer, ground, wood, concrete } = fixture()
    const material = ground.material as ShadowMaterial
    expect(ground.visible).toBe(false)
    layer.setGround(0.5)
    expect(ground.visible).toBe(true)
    expect(material.opacity).toBeCloseTo(GROUND_OPACITY / 2, 12)
    layer.setGround(2)
    expect(material.opacity).toBeCloseTo(GROUND_OPACITY, 12)
    layer.setGround(0)
    expect(ground.visible).toBe(false)
    expect(material.depthWrite).toBe(false)
    expect(ground.receiveShadow).toBe(true)
    expect(ground.renderOrder).toBe(-1)
    expect(ground.position.z).toBe(-30)
    expect(material.color.getHexString()).toBe('1d1d1f')

    const lumber = (m: InstancedMesh) => (m.material as LumberMaterial).lumber
    layer.resize({ W: 100, H: 100, dpr: 2, frame: { x: 0, y: 0, w: 100, h: 100 }, wide: true })
    expect(lumber(wood).uLinePx.value).toBe(1.5)
    expect(lumber(wood).uAILinePx.value).toBe(2)
    expect(lumber(concrete).uLinePx.value).toBe(1.5)
    layer.resize({ W: 100, H: 100, dpr: 1, frame: { x: 0, y: 0, w: 100, h: 100 }, wide: true })
    expect(lumber(concrete).uLinePx.value).toBe(1)
  })

  it('lights the frame from plan space: sky up, sun at 215°/50°, shadow settings', () => {
    const { layer, sun, sky } = fixture()
    const root = createHouseRoot()
    root.add(layer.group)
    root.updateMatrixWorld(true)
    const up = new Vector3().setFromMatrixPosition(sky.matrixWorld).normalize()
    expect(up.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12)
    const toSun = new Vector3()
      .setFromMatrixPosition(sun.matrixWorld)
      .sub(new Vector3().setFromMatrixPosition(sun.target.matrixWorld))
      .normalize()
    expect(toSun.distanceTo(planToWorld(...SUN_DIR))).toBeLessThan(1e-9)
    expect(sun.intensity).toBe(SUN_INTENSITY)
    expect(sky.intensity).toBe(2)
    expect(sky.groundColor.getHexString()).toBe('f2f2f2')
    expect(sun.castShadow).toBe(true)
    expect([sun.shadow.mapSize.x, sun.shadow.mapSize.y]).toEqual([2048, 2048])
    expect([sun.shadow.radius, sun.shadow.normalBias, sun.shadow.bias]).toEqual([2, 0.5, -3e-5])
    expect(sun.target.parent).toBe(layer.group)
  })

  it("fits the shadow camera with three's own lookAt: every corner and its ground shadow lands in the map", () => {
    const { layer, sun } = fixture()
    const root = createHouseRoot()
    root.add(layer.group)
    root.updateMatrixWorld(true)
    sun.shadow.updateMatrices(sun)
    const cam = sun.shadow.camera
    const clip = new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    const ndc = (p: Vec3) => planToWorld(...p).applyMatrix4(clip)
    const corners = boxCorners(BOUNDS)
    for (const p of [...corners, ...onGround(corners, SUN_DIR, -30)]) {
      const q = ndc(p)
      for (const v of [q.x, q.y, q.z]) expect(Math.abs(v)).toBeLessThan(1)
    }

    // The fit's basis is the one Matrix4.lookAt builds from the light to its target, with world up.
    const fit = fitSunShadow(corners, SUN_DIR, SHADOW.margin, -30)
    const look = new Matrix4().lookAt(planToWorld(...fit.position), planToWorld(...fit.target), new Vector3(0, 1, 0))
    const axes = [new Vector3(), new Vector3(), new Vector3()] as const
    look.extractBasis(...axes)
    fit.basis.forEach((b, i) => expect(axes[i].distanceTo(planToWorld(...b))).toBeLessThan(1e-12))
    // And it is what three set on the shadow camera.
    const camAxes = [new Vector3(), new Vector3(), new Vector3()] as const
    cam.matrixWorld.extractBasis(...camAxes)
    fit.basis.forEach((b, i) => expect(camAxes[i].distanceTo(planToWorld(...b))).toBeLessThan(1e-9))
  })

  it('warms the depth program through a proxy, under a render target, lit by the target scene', async () => {
    let bound: WebGLRenderTarget | null = null
    const log: string[] = []
    const stub = {
      shadowMap: { needsUpdate: false },
      getRenderTarget: () => bound,
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      setRenderTarget(t: WebGLRenderTarget | null) {
        bound = t
        log.push(t ? 'bind target' : 'bind canvas')
      },
      compileAsync: vi.fn((...args: [object: InstancedMesh, camera: unknown, target: Scene]): Promise<unknown> => {
        log.push(bound instanceof WebGLRenderTarget ? 'compile under target' : 'compile on canvas')
        return Promise.resolve(args[0])
      }),
    }
    const { layer, wood } = fixture(stub)
    const scene = new Scene()
    await layer.warm(new PerspectiveCamera(), scene)
    expect(stub.compileAsync).toHaveBeenCalledOnce()
    const [object, , target] = stub.compileAsync.mock.calls[0]
    expect(object.material).toBe(wood.customDepthMaterial)
    expect(object.geometry).toBe(wood.geometry)
    expect(object.instanceColor).not.toBeNull()
    expect(target).toBe(scene)
    expect(log).toEqual(['bind target', 'compile under target', 'bind canvas'])
    expect(bound).toBeNull()

    // It never rejects, so the stage's reveal never waits on a failed compile.
    stub.compileAsync.mockImplementationOnce(() => {
      throw new Error('context lost')
    })
    await expect(layer.warm(new PerspectiveCamera(), scene)).resolves.toBeUndefined()
    stub.compileAsync.mockImplementationOnce(() => Promise.reject(new Error('context lost')))
    await expect(layer.warm(new PerspectiveCamera(), scene)).resolves.toBeUndefined()
    expect(bound).toBeNull()

    // After dispose it does nothing.
    layer.dispose()
    stub.compileAsync.mockClear()
    await layer.warm(new PerspectiveCamera(), scene)
    expect(stub.compileAsync).not.toHaveBeenCalled()
  })

  it('disposes everything it made and leaves the scene', () => {
    const { layer, wood, concrete, ground, sun } = fixture()
    const root = createHouseRoot()
    root.add(layer.group)
    const disposed = new Set<unknown>()
    const watch = (o: { addEventListener(type: 'dispose', fn: () => void): void }) =>
      o.addEventListener('dispose', () => disposed.add(o))
    const materials = [wood.material, concrete.material, wood.customDepthMaterial!, ground.material] as Material[]
    const geometries = [wood.geometry, concrete.geometry, ground.geometry]
    for (const o of [...materials, ...geometries, wood, concrete]) watch(o)
    const shadowDispose = vi.spyOn(sun.shadow, 'dispose')
    layer.dispose()
    for (const o of [...materials, ...geometries, wood, concrete]) expect(disposed.has(o)).toBe(true)
    expect(shadowDispose).toHaveBeenCalled()
    expect(layer.group.parent).toBeNull()
  })
})
