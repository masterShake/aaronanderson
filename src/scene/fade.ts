/**
 * Per-element fade: one texel per PlanDrawing element (1 = full ink, 0 = paper), sampled by every
 * line and fill material. All 1 this round. Chapter 2 sets a wall's texel toward 0 as its studs
 * rise, so its linework retires without rebuilding any geometry.
 */
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from 'three'

export interface ElementFade {
  texture: DataTexture
  set(element: number, value: number): void
}

export function createElementFade(count: number): ElementFade {
  const n = Math.max(1, count)
  const data = new Uint8Array(n * 4).fill(255)
  const texture = new DataTexture(data, n, 1, RGBAFormat, UnsignedByteType)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return {
    texture,
    set(element, value) {
      const v = Math.round(Math.min(1, Math.max(0, value)) * 255)
      if (data[element * 4] === v) return
      data.fill(v, element * 4, element * 4 + 4)
      texture.needsUpdate = true
    },
  }
}
