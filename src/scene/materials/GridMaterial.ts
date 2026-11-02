/**
 * The drafting grid, drawn analytically on one large plane in plan space: 12″ minor lines
 * (only where they are at least 8 px apart) and 48″ major lines, each about one device pixel
 * wide. It is revealed radially from the house centre and fades out toward the sheet edge.
 * Chapter 1 owns `reveal`; chapter 2 owns `fade` (1 = drawn, 0 = paper) as it retires the sheet.
 */
import { Color, ShaderMaterial, Vector2, type IUniform } from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vPlan;
  void main() {
    vPlan = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uMinor;
  uniform vec3 uMajor;
  uniform vec2 uCenter;
  uniform float uReveal;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  uniform float uDpr;
  uniform float uFade;
  varying vec2 vPlan;

  // Coverage of grid lines with the given spacing, one device pixel wide, antialiased.
  // fwidth() is in plan inches per device pixel.
  float grid( float spacing ) {
    vec2 w = fwidth( vPlan );
    vec2 g = abs( fract( vPlan / spacing - 0.5 ) - 0.5 ) * spacing;
    vec2 cov = 1.0 - clamp( g / w - 0.5, 0.0, 1.0 );
    return max( cov.x, cov.y );
  }

  void main() {
    float d = length( vPlan - uCenter );
    float reveal = 1.0 - smoothstep( uReveal - 24.0, uReveal, d );
    float edge = 1.0 - smoothstep( uFadeStart, uFadeEnd, d );
    // Minor lines only where 12″ is at least 8 CSS px on screen.
    float px = 12.0 / ( fwidth( vPlan.x ) * uDpr );
    float minorOn = smoothstep( 7.0, 9.0, px );
    float minor = grid( 12.0 ) * minorOn;
    float major = grid( 48.0 );
    vec3 c = vec3( 1.0 );
    c = mix( c, uMinor, minor * reveal * edge );
    c = mix( c, uMajor, major * reveal * edge );
    c = mix( vec3( 1.0 ), c, uFade );
    gl_FragColor = vec4( c, 1.0 );
    #include <colorspace_fragment>
  }
`

export class GridMaterial extends ShaderMaterial {
  constructor(minor: Color, major: Color, center: Vector2) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMinor: { value: minor },
        uMajor: { value: major },
        uCenter: { value: center },
        uReveal: { value: 0 },
        uFadeStart: { value: 600 },
        uFadeEnd: { value: 1400 },
        uDpr: { value: 1 },
        uFade: { value: 1 },
      },
      toneMapped: false,
      depthWrite: false,
      depthTest: true,
      transparent: false,
    })
  }

  set reveal(r: number) {
    ;(this.uniforms.uReveal as IUniform<number>).value = r
  }

  set dpr(v: number) {
    ;(this.uniforms.uDpr as IUniform<number>).value = v
  }

  /** 1 = drawn, 0 = paper. */
  set fade(v: number) {
    ;(this.uniforms.uFade as IUniform<number>).value = v
  }

  setFade(start: number, end: number) {
    ;(this.uniforms.uFadeStart as IUniform<number>).value = start
    ;(this.uniforms.uFadeEnd as IUniform<number>).value = end
  }
}
