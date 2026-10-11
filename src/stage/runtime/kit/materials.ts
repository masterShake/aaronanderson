import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
} from 'three'
import { COLOR } from '@/styles/tokens'
import type { Quality } from '../../types'

/**
 * Materials (§2.7, D9). 'physical' (desktop): MeshPhysical with anisotropy;
 * 'standard' (touch): MeshStandard. Tuning numbers live here (critic 17);
 * only the colors are frozen, in src/styles/tokens.ts. Shared instances are
 * session-scoped (userData.shared): scenes clone them per part and dispose
 * only what is not shared.
 */

export const TUNING = {
  aluminum: {
    physical: {
      color: COLOR.alu500,
      metalness: 1,
      roughness: 0.4,
      anisotropy: 0.85,
      envMapIntensity: 0.8,
    },
    standard: { color: COLOR.alu500, metalness: 1, roughness: 0.44, envMapIntensity: 0.8 },
  },
  orange: {
    physical: {
      metalness: 0,
      roughness: 0.7,
      specularIntensity: 0.15,
      clearcoat: 0,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.55,
    },
    standard: { metalness: 0, roughness: 0.85, envMapIntensity: 0.55 },
  },
  glass: { roughness: 0.06, opacity: 0.32, envMapIntensity: 1.4 },
  slot: { roughness: 0.8 },
  /** Key light: no decay, infinite range, NW and above the model centre (× span). */
  keyLight: { intensity: 1.4, offset: [-0.6, 0.75, -0.6] as const },
} as const

const shared = new Map<string, Material>()

/**
 * three ignores material.envMapIntensity for scene.environment (it uses
 * scene.environmentIntensity, one value for every material). So the lit
 * materials here carry the session's PMREM as their own envMap, set by
 * buildEnv (./env.ts) through bindEnv, and TUNING's per-material env
 * intensities apply: brushed aluminum short of white, orange that stays orange.
 */
let envTex: Texture | null = null
const lit = new Set<MeshStandardMaterial>()

function track<M extends Material>(m: M): M {
  if ((m as unknown as MeshStandardMaterial).isMeshStandardMaterial) {
    const s = m as unknown as MeshStandardMaterial
    lit.add(s)
    if (envTex && s.envMap !== envTex) {
      s.envMap = envTex
      s.needsUpdate = true
    }
  }
  return m
}

/** The session environment for every lit kit material (called by buildEnv; null on destroy). */
export function bindEnv(tex: Texture | null): void {
  envTex = tex
  for (const m of lit) {
    m.envMap = tex
    m.needsUpdate = true
  }
}

function share<M extends Material>(key: string, make: () => M): M {
  let m = shared.get(key) as M | undefined
  if (!m) {
    m = make()
    m.userData.shared = true
    shared.set(key, m)
  }
  return track(m)
}

const OFFSET = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const

export function aluminum(q: Quality): MeshStandardMaterial {
  return share(`alu:${q}`, () =>
    q === 'physical'
      ? new MeshPhysicalMaterial({
          ...TUNING.aluminum.physical,
          anisotropyRotation: 0,
          ...OFFSET,
        })
      : new MeshStandardMaterial({ ...TUNING.aluminum.standard, ...OFFSET }),
  )
}

export function powderOrange(q: Quality): MeshStandardMaterial {
  return share(`orange:${q}`, () =>
    q === 'physical'
      ? new MeshPhysicalMaterial({ color: COLOR.orange, ...TUNING.orange.physical, ...OFFSET })
      : new MeshStandardMaterial({ color: COLOR.orange, ...TUNING.orange.standard, ...OFFSET }),
  )
}

export function glass(q: Quality): MeshStandardMaterial {
  const o = {
    color: COLOR.labelOnDeep,
    transparent: true,
    depthWrite: false,
    ...TUNING.glass,
  }
  return share(`glass:${q}`, () =>
    q === 'physical' ? new MeshPhysicalMaterial(o) : new MeshStandardMaterial(o),
  )
}

/** Unlit orange: packets, lamps, pulse rings. Never tone mapped. */
export function emissive(color: string = COLOR.orange): MeshBasicMaterial {
  return share(`basic:${color}`, () => new MeshBasicMaterial({ color, toneMapped: false }))
}

export function slotMat(): MeshStandardMaterial {
  return share('slot', () => new MeshStandardMaterial({ color: COLOR.asphalt, ...TUNING.slot }))
}

/** Paper cut-out card: alpha-tested, both sides, unlit. Per texture, so not shared. */
export function paperCard(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map,
    alphaTest: 0.5,
    alphaToCoverage: true,
    side: DoubleSide,
    toneMapped: false,
  })
}

export type FlatMixed<M extends MeshStandardMaterial> = M & { uFlat: { value: number } }

/**
 * A per-part copy of a shared material whose final colour mixes toward the
 * flat panel tone (exactly #143A6B at uFlat = 1, after tone mapping), so the
 * faces are invisible against the CSS panel in the plan pose. All copies
 * share one program.
 */
export function withFlatMix<M extends MeshStandardMaterial>(
  base: M,
  flat: string = COLOR.blueprintDeep,
): FlatMixed<M> {
  const m = base.clone() as M
  m.userData = { shared: false }
  const uFlat = { value: 1 }
  const uFlatColor = { value: new Color(flat) }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlat = uFlat
    sh.uniforms.uFlatColor = uFlatColor
    sh.fragmentShader =
      'uniform float uFlat;\nuniform vec3 uFlatColor;\n' +
      sh.fragmentShader.replace(
        '#include <colorspace_fragment>',
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlatColor, uFlat);\n#include <colorspace_fragment>',
      )
  }
  m.customProgramCacheKey = () => 'flat1'
  m.addEventListener('dispose', () => lit.delete(m))
  return Object.assign(track(m), { uFlat })
}

/** Disposes the session-scoped materials (Stage destroy only). */
export function disposeShared(): void {
  for (const m of shared.values()) m.dispose()
  shared.clear()
  lit.clear()
  envTex = null
}
