/**
 * The lumber's shadow caster: three's MeshDepthMaterial with a dithered discard by aState.x. A member
 * fading in casts a proportionally sparse shadow, which PCF turns into a proportionally light one.
 * The dither is interleaved gradient noise in shadow-map pixels, so it never lines up with the
 * receiver's own PCF noise.
 *
 * It is built with the settings WebGLShadowMap gives its own depth material for a FrontSide caster
 * with no maps, alpha test or clipping: side BackSide, basic depth packing. The program that
 * buildLumber's warm() compiles is then the exact one the shadow pass asks for. Every anchor must
 * occur exactly once in three r187's ShaderLib.depth (see the lumber test).
 */
import { BackSide, MeshDepthMaterial, type WebGLProgramParametersWithUniforms } from 'three'
import { inject } from '@/scene/materials/inject'

export const LUMBER_DEPTH_PROGRAM = 'lumber-depth/1'

export function patchDepthVertex(vs: string): string {
  vs = inject(vs, '#include <common>', 'attribute vec4 aState;\nflat varying float vLumAlpha;')
  return inject(vs, '#include <begin_vertex>', 'vLumAlpha = aState.x;')
}

export function patchDepthFragment(fs: string): string {
  fs = inject(fs, '#include <common>', 'flat varying float vLumAlpha;')
  return inject(
    fs,
    '#include <clipping_planes_fragment>',
    'if ( vLumAlpha < 1.0 && vLumAlpha <= fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) ) discard;',
  )
}

export class LumberDepthMaterial extends MeshDepthMaterial {
  constructor() {
    // WebGLShadowMap sets side to the caster's shadowSide, or else the flip of its side: BackSide for
    // FrontSide lumber. Setting it here makes the precompiled program key match from the start.
    super({ side: BackSide })
  }

  onBeforeCompile(shader: WebGLProgramParametersWithUniforms): void {
    shader.vertexShader = patchDepthVertex(shader.vertexShader)
    shader.fragmentShader = patchDepthFragment(shader.fragmentShader)
  }

  customProgramCacheKey(): string {
    return LUMBER_DEPTH_PROGRAM
  }
}
