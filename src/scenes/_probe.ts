import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  HalfFloatType,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  Shape,
  SpotLight,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { SceneModule } from '@/stage/types'

/**
 * The W0 bundle probe: imports the whole planned three subset (stage-hero §7)
 * and touches every class, so its gzip size is an upper bound for the runtime
 * group. Loaded only from the preview-only /kit/stage?probe=1. Never shipped
 * to a public page. Owner after W0: stage lane.
 */
export const PROBE_CLASSES = [
  WebGLRenderer,
  WebGLRenderTarget,
  PMREMGenerator,
  Scene,
  Group,
  Object3D,
  Mesh,
  InstancedMesh,
  Vector2,
  Vector3,
  Quaternion,
  Matrix4,
  Color,
  Shape,
  CatmullRomCurve3,
  OrthographicCamera,
  PerspectiveCamera,
  ExtrudeGeometry,
  TubeGeometry,
  CylinderGeometry,
  CapsuleGeometry,
  TorusGeometry,
  RingGeometry,
  CircleGeometry,
  PlaneGeometry,
  BoxGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PointLight,
  SpotLight,
  CanvasTexture,
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegments2,
  LineSegmentsGeometry,
  RoomEnvironment,
] as const

export const PROBE_CONSTANTS = [
  NeutralToneMapping,
  SRGBColorSpace,
  HalfFloatType,
  DynamicDrawUsage,
  DoubleSide,
  MathUtils.degToRad(45),
] as const

const mod: SceneModule = {
  id: '_probe',
  create(ctx) {
    const three = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 8000)
    const shape = new Shape([new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1)])
    const body = new Mesh(
      new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }),
      ctx.quality === 'physical'
        ? new MeshPhysicalMaterial({ metalness: 1, roughness: 0.3, anisotropy: 0.8 })
        : new MeshStandardMaterial({ metalness: 1, roughness: 0.4 }),
    )
    const pipe = new Mesh(
      new TubeGeometry(new CatmullRomCurve3([new Vector3(), new Vector3(1, 0, 0)]), 8, 0.1, 8),
      new MeshBasicMaterial({ toneMapped: false }),
    )
    const packets = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 8)
    packets.frustumCulled = false
    const lineGeo = new LineSegmentsGeometry().setPositions([0, 0, 0, 1, 0, 0])
    const lines = new LineSegments2(
      lineGeo,
      new LineMaterial({ linewidth: 1.5, toneMapped: false }),
    )
    three.add(body, pipe, packets, lines)
    return {
      three,
      rig: { camera, pose() {} },
      *build() {
        const pmrem = new PMREMGenerator(ctx.renderer)
        three.environment = pmrem.fromScene(new RoomEnvironment(), 0, 0.1, 100, {
          size: 128,
        }).texture
        yield
      },
      reset() {},
      start() {},
      update: () => ({ animating: false }),
      setPose() {},
      resize() {},
      dispose() {
        three.clear()
      },
    }
  },
}

export default mod
