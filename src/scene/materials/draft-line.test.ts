import { DataTexture } from 'three'
import { describe, expect, it } from 'vitest'
import { DraftLineMaterial, inject, penColor } from '@/scene/materials/DraftLineMaterial'

describe('DraftLineMaterial', () => {
  it('patches the installed three LineMaterial shaders', () => {
    const m = new DraftLineMaterial(
      { color: '#1d1d1f', linewidth: 1, dashed: true },
      { progress: { value: 0 }, fadeTex: { value: new DataTexture(new Uint8Array(4), 1, 1) } },
      { color: penColor('#1f5bff'), settle: 0.012, settleFrom: 0 },
    )
    expect(m.vertexShader).toContain('attribute vec2 instanceTime;')
    expect(m.vertexShader).toContain('mix( instanceStart, instanceEnd, max( drawK, 1e-4 ) )')
    expect(m.vertexShader).toContain('mix( instanceDistanceStart, instanceDistanceEnd, drawK )')
    expect(m.fragmentShader).toContain('mix( uPen, diffuseColor.rgb, vInk )')
    // drawK must be declared before the dash code that uses it.
    expect(m.vertexShader.indexOf('float drawK')).toBeLessThan(m.vertexShader.indexOf('float lineDistanceEnd'))
    m.fade = 0.5
    expect(m.fade).toBe(0.5)
  })

  it('refuses a missing or repeated anchor', () => {
    expect(() => inject('abc', 'zzz', 'x')).toThrow()
    expect(() => inject('a;a;', 'a;', 'x')).toThrow()
  })
})
