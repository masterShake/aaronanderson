/**
 * Lumber and concrete: three's MeshLambertMaterial, patched, and drawn instanced on one unit box.
 *
 * Per instance:
 * - instanceMatrix, with columns u·L, v·W, w·H and the centre. The shader reads the box size back
 *   from the column lengths, so no size attribute is needed.
 * - instanceColor: the member's tone (lib/framing/look.ts toneOf).
 * - aState = [alpha, ai, 0, 0].
 *
 * Per pixel, on top of Lambert lighting (a sunlit top face renders at exactly the albedo):
 * - End grain on the cut ends: the box's ±x faces, which are the member's ±u ends.
 * - Edge lines from screen-space derivatives: the lit colour × uEdgeK, about 0.75 CSS px. They fade
 *   out on faces too small on screen to carry a line. While a member is being placed (ai → 1), its
 *   edges draw in AI blue at about 1 px. Faces always stay lit wood.
 * - alpha = aState.x. The material is transparent but writes depth, and instances are drawn in start
 *   order, so landed members (alpha 1) come first and render exactly.
 *
 * Wood and concrete share one program (customProgramCacheKey); only their uniforms differ. Every
 * anchor must occur exactly once in three r187's ShaderLib.lambert (see the lumber test).
 */
import {
  Color,
  MeshLambertMaterial,
  Vector3,
  Vector4,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { EDGE, type Look } from '@/lib/framing/look'
import { PALETTE } from '@/lib/plan/pens'
import { inject } from '@/scene/materials/inject'

/** One cache key for wood and concrete: the GLSL is identical, so they share a program. */
export const LUMBER_PROGRAM = 'lumber/1'

/** Uniforms every lumber material shares by reference, so resize() sets them once. */
export interface LumberShared {
  /** Settled edge width, device px. */
  linePx: IUniform<number>
  /** AI edge width, device px. */
  aiLinePx: IUniform<number>
  /** Edge LOD, in line widths of the face's short side on screen: settled [from, to], then AI [from, to]. */
  lod: IUniform<Vector4>
}

export const createLumberShared = (): LumberShared => ({
  linePx: { value: 1 },
  aiLinePx: { value: 1 },
  lod: { value: new Vector4(EDGE.lod[0], EDGE.lod[1], EDGE.aiLod[0], EDGE.aiLod[1]) },
})

export function patchLumberVertex(vs: string): string {
  vs = inject(
    vs,
    '#include <common>',
    [
      'attribute vec4 aState;',
      'flat varying vec4 vLumState;',
      'flat varying vec3 vLumHalf;',
      'flat varying vec3 vLumN;',
      'varying vec3 vLumLocal;',
    ].join('\n'),
  )
  // Box-local position in inches (centre at 0), its half-size, and the face's own axis.
  return inject(
    vs,
    '#include <begin_vertex>',
    `#ifdef USE_INSTANCING
	vec3 lumSize = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
#else
	vec3 lumSize = vec3( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ), length( modelMatrix[ 2 ].xyz ) );
#endif
	vLumHalf = 0.5 * lumSize;
	vLumLocal = position * lumSize;
	vLumN = normal;
	vLumState = aState;`,
  )
}

export function patchLumberFragment(fs: string): string {
  fs = inject(
    fs,
    '#include <common>',
    [
      'uniform vec3 uEndGrain;',
      'uniform vec3 uAI;',
      'uniform float uEdgeK;',
      'uniform float uLinePx;',
      'uniform float uAILinePx;',
      'uniform vec4 uLod;',
      'flat varying vec4 vLumState;',
      'flat varying vec3 vLumHalf;',
      'flat varying vec3 vLumN;',
      'varying vec3 vLumLocal;',
    ].join('\n'),
  )
  // Cut ends, before lighting: the box's x axis is the member's grain.
  fs = inject(
    fs,
    '#include <color_fragment>',
    'diffuseColor.rgb *= mix( vec3( 1.0 ), uEndGrain, step( 0.5, abs( vLumN.x ) ) );',
  )
  // After lighting, before the output: edge lines, then alpha.
  return inject(
    fs,
    '#include <opaque_fragment>',
    `{
		// Distance to this face's nearest edge and the face's short side, both in device px: box inches
		// over inches per pixel along each box axis. The face's own axis carries no edge.
		vec3 lumGx = dFdx( vLumLocal );
		vec3 lumGy = dFdy( vLumLocal );
		vec3 lumG = max( sqrt( lumGx * lumGx + lumGy * lumGy ), vec3( 1e-5 ) );
		vec3 lumOwn = step( 0.5, abs( vLumN ) );
		vec3 lumTo = mix( ( vLumHalf - abs( vLumLocal ) ) / lumG, vec3( 1e4 ), lumOwn );
		vec3 lumSpan = mix( 2.0 * vLumHalf / lumG, vec3( 1e4 ), lumOwn );
		float lumEdge = min( lumTo.x, min( lumTo.y, lumTo.z ) );
		float lumShort = min( lumSpan.x, min( lumSpan.y, lumSpan.z ) );
		float lumAI = vLumState.y;
		float lumW = mix( uLinePx, uAILinePx, lumAI );
		// Faces too small on screen carry no line, so the frame never becomes a wireframe.
		float lumLod = smoothstep( mix( uLod.x, uLod.z, lumAI ) * lumW, mix( uLod.y, uLod.w, lumAI ) * lumW, lumShort );
		float lumLine = ( 1.0 - smoothstep( lumW - 0.5, lumW + 0.5, lumEdge ) ) * lumLod;
		outgoingLight = mix( outgoingLight, mix( outgoingLight * uEdgeK, uAI, lumAI ), lumLine );
		diffuseColor.a *= vLumState.x;
	}
	#include <opaque_fragment>`,
    true,
  )
}

export class LumberMaterial extends MeshLambertMaterial {
  /** Added to the program's uniforms in onBeforeCompile. The shared ones are held by reference. */
  readonly lumber: Record<string, IUniform>

  constructor(look: Look, shared: LumberShared) {
    super({ color: look.albedo, transparent: true, depthWrite: true, toneMapped: false })
    this.lumber = {
      uEndGrain: { value: new Vector3(...look.endGrain) },
      uAI: { value: new Color(PALETTE.ai) },
      uEdgeK: { value: look.edge },
      uLinePx: shared.linePx,
      uAILinePx: shared.aiLinePx,
      uLod: shared.lod,
    }
  }

  onBeforeCompile(shader: WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, this.lumber)
    shader.vertexShader = patchLumberVertex(shader.vertexShader)
    shader.fragmentShader = patchLumberFragment(shader.fragmentShader)
  }

  customProgramCacheKey(): string {
    return LUMBER_PROGRAM
  }
}
