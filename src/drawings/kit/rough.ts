/**
 * roughjs presets (pages-drawings §5.2). Plain data, so tests can check the
 * caps: roughness ≤ 1.2 and bowing ≤ 1. The generator itself runs only in
 * render/pencil.ts (server and build time).
 */

export interface RoughPreset {
  roughness: number
  bowing: number
  disableMultiStroke: boolean
  preserveVertices: boolean
  maxRandomnessOffset: number
}

export type PresetId = 'box' | 'line' | 'cloud' | 'person' | 'scribble' | 'detail'

/**
 * W4: box, line and detail are confident single strokes. render/pencil.ts
 * draws their straights one segment at a time, overshooting each corner a
 * little and easing the bow off on long runs, so a long line stays straight.
 */
export const ROUGH: Readonly<Record<PresetId, RoughPreset>> = {
  box: {
    roughness: 0.9,
    bowing: 0.8,
    disableMultiStroke: true,
    preserveVertices: true,
    maxRandomnessOffset: 1.2,
  },
  line: {
    roughness: 0.8,
    bowing: 0.8,
    disableMultiStroke: true,
    preserveVertices: true,
    maxRandomnessOffset: 1.1,
  },
  detail: {
    roughness: 0.4,
    bowing: 0.3,
    disableMultiStroke: true,
    preserveVertices: true,
    maxRandomnessOffset: 0.5,
  },
  cloud: {
    roughness: 0.8,
    bowing: 0.6,
    disableMultiStroke: true,
    preserveVertices: true,
    maxRandomnessOffset: 1.0,
  },
  person: {
    roughness: 0.45,
    bowing: 0.3,
    disableMultiStroke: true,
    preserveVertices: true,
    maxRandomnessOffset: 0.8,
  },
  scribble: {
    roughness: 1.2,
    bowing: 1.0,
    disableMultiStroke: false,
    preserveVertices: false,
    maxRandomnessOffset: 2.0,
  },
}

export const ROUGH_CAPS = { roughness: 1.2, bowing: 1 } as const
