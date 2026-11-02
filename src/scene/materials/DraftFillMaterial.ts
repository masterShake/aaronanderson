/**
 * Opaque fills (poché, solid marks, AI clearance washes) that appear on schedule. Per vertex:
 * aTime [t0, t1] and aWipe (0 → 1 along the direction the pen drew the element). In WIPE mode a
 * fragment shows once the wipe front has passed it; otherwise the fill fades in from paper.
 */
import { Color, ShaderMaterial, type IUniform } from 'three'
import type { DraftUniforms } from '@/scene/materials/DraftLineMaterial'

const vertexShader = /* glsl */ `
  attribute vec2 aTime;
  attribute float aWipe;
  attribute float aElement;
  uniform float uProgress;
  uniform sampler2D uFadeTex;
  varying float vK;
  varying float vWipe;
  varying float vEl;
  void main() {
    vK = clamp( ( uProgress - aTime.x ) / max( aTime.y - aTime.x, 1e-6 ), 0.0, 1.0 );
    vWipe = aWipe;
    vEl = texelFetch( uFadeTex, ivec2( int( aElement ), 0 ), 0 ).r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vK;
  varying float vWipe;
  varying float vEl;
  void main() {
    #ifdef WIPE
      if ( vK <= 0.0 || vWipe > vK ) discard;
      float k = 1.0;
    #else
      if ( vK <= 0.0 ) discard;
      float k = vK;
    #endif
    gl_FragColor = vec4( mix( vec3( 1.0 ), uColor, k * uFade * vEl ), 1.0 );
    #include <colorspace_fragment>
  }
`

export class DraftFillMaterial extends ShaderMaterial {
  constructor(color: Color, shared: DraftUniforms, mode: 'wipe' | 'fade') {
    super({
      vertexShader,
      fragmentShader,
      defines: mode === 'wipe' ? { WIPE: '' } : {},
      uniforms: {
        uProgress: shared.progress,
        uFadeTex: shared.fadeTex,
        uColor: { value: color },
        uFade: { value: 1 },
      },
      toneMapped: false,
      depthWrite: false,
      depthTest: true,
      transparent: false,
    })
  }

  get fade(): number {
    return (this.uniforms.uFade as IUniform<number>).value
  }

  set fade(v: number) {
    ;(this.uniforms.uFade as IUniform<number>).value = v
  }
}
