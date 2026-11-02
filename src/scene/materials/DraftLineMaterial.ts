/**
 * three's fat-line LineMaterial, patched so one mesh can draw thousands of segments, each on its
 * own schedule. Per segment:
 * - instanceTime [t0, t1]: the segment grows from its start point between t0 and t1 of uProgress
 *   (segments not yet started collapse off screen);
 * - instanceElement: index into the shared per-element fade texture (1 = ink, 0 = paper).
 * A freshly drawn segment is pen-blue and settles to the line colour over uSettle of progress.
 *
 * The anchors below are asserted to occur exactly once in three r187's shader. three is pinned;
 * after any upgrade the constructor throws if an anchor moved (see draft-line test).
 */
import { Color, type DataTexture, type IUniform } from 'three'
import { LineMaterial, type LineMaterialParameters } from 'three/addons/lines/LineMaterial.js'
import { inject } from '@/scene/materials/inject'

export { inject }

export interface DraftUniforms {
  progress: IUniform<number>
  fadeTex: IUniform<DataTexture>
}

export function patchVertex(vs: string): string {
  vs = inject(
    vs,
    'uniform vec2 resolution;',
    [
      'uniform float uProgress;',
      'uniform float uSettle;',
      'uniform float uSettleFrom;',
      'uniform sampler2D uFadeTex;',
      'attribute vec2 instanceTime;',
      'attribute float instanceElement;',
      'varying float vInk;',
      'varying float vEl;',
    ].join('\n'),
  )
  vs = inject(
    vs,
    'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
    `float drawK = clamp( ( uProgress - instanceTime.x ) / max( instanceTime.y - instanceTime.x, 1e-6 ), 0.0, 1.0 );
			vInk = clamp( ( uProgress - max( instanceTime.y, uSettleFrom ) ) / max( uSettle, 1e-6 ), 0.0, 1.0 );
			vEl = texelFetch( uFadeTex, ivec2( int( instanceElement ), 0 ), 0 ).r;
			vec4 end = modelViewMatrix * vec4( mix( instanceStart, instanceEnd, max( drawK, 1e-4 ) ), 1.0 );`,
    true,
  )
  vs = inject(
    vs,
    'float lineDistanceEnd = dashScale * instanceDistanceEnd;',
    'float lineDistanceEnd = dashScale * mix( instanceDistanceStart, instanceDistanceEnd, drawK );',
    true,
  )
  return inject(vs, 'gl_Position = clip;', 'if ( drawK <= 0.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );')
}

export function patchFragment(fs: string): string {
  fs = inject(fs, 'uniform float linewidth;', 'uniform vec3 uPen;\nuniform float uFade;\nvarying float vInk;\nvarying float vEl;')
  // Blue tip → pen colour, then the layer and element fades mix toward paper (no alpha blending,
  // so overlapping caps never double up).
  return inject(
    fs,
    '#include <color_fragment>',
    'diffuseColor.rgb = mix( vec3( 1.0 ), mix( uPen, diffuseColor.rgb, vInk ), uFade * vEl );',
  )
}

export class DraftLineMaterial extends LineMaterial {
  constructor(
    params: LineMaterialParameters,
    shared: DraftUniforms,
    tip: { color: Color; settle: number; settleFrom: number },
  ) {
    super({ toneMapped: false, depthWrite: false, depthTest: true, transparent: false, alphaToCoverage: false, ...params })
    Object.assign(this.uniforms, {
      uProgress: shared.progress,
      uFadeTex: shared.fadeTex,
      uSettle: { value: tip.settle },
      uSettleFrom: { value: tip.settleFrom },
      uPen: { value: tip.color },
      uFade: { value: 1 },
    })
    this.vertexShader = patchVertex(this.vertexShader)
    this.fragmentShader = patchFragment(this.fragmentShader)
  }

  /** Whole-layer fade: 1 = full colour, 0 = paper. */
  get fade(): number {
    return (this.uniforms.uFade as IUniform<number>).value
  }

  set fade(v: number) {
    ;(this.uniforms.uFade as IUniform<number>).value = v
  }
}

export const penColor = (hex: string): Color => new Color(hex)
