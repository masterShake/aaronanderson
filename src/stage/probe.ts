import { forcedTier, getTier, tierMax } from './tier'

/**
 * Can this visit have 3D? No three here: this runs in the main bundle, before
 * the runtime chunk is fetched. The tier itself comes from the head script
 * (data-tier, data-tier-max, data-tier-force); the Stage never reads
 * matchMedia for reduced motion or the ?tier query.
 */

/** The one context's attributes. The canvas is transparent over the CSS panel. */
export const GL_ATTRS: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
  failIfMajorPerformanceCaveat: true,
}

/** Renderer strings that mean the GPU is emulated on the CPU. */
export const SOFTWARE = /swiftshader|llvmpipe|lavapipe|softpipe|software|basic render/i

export interface Probe {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  /** The unmasked renderer string, for the tests and the debug state. */
  renderer: string
  /** True when a forced ?tier=webgl relaxed the hardware checks. */
  forced: boolean
}

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }

/** Why this visit gets no 3D, or null when it may try. Cheap and synchronous. */
export function ineligible(): string | null {
  if (typeof window === 'undefined') return 'server'
  const tier = getTier()
  if (tier === 'still') return 'still'
  if (tierMax() !== 'webgl') return 'tier-max'
  if (forcedTier() === 'webgl')
    return typeof WebGL2RenderingContext === 'undefined' ? 'webgl2' : null
  const n = navigator as Nav
  if (n.connection?.saveData) return 'save-data'
  if (n.deviceMemory !== undefined && n.deviceMemory < 4) return 'device-memory'
  if (typeof WebGL2RenderingContext === 'undefined') return 'webgl2'
  return null
}

/** The renderer string, unmasked where the browser still masks it. */
export function rendererString(gl: WebGL2RenderingContext): string {
  let r = String(gl.getParameter(gl.RENDERER) ?? '')
  if (!r || /^webkit webgl$/i.test(r)) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? r)
  }
  return r
}

/**
 * Creates the session's one WebGL2 context, or returns null (no WebGL2, a
 * major performance caveat, or a software renderer). A forced ?tier=webgl
 * relaxes the caveat and software checks; the tests then assert hardware.
 */
export function probe(): Probe | null {
  const forced = forcedTier() === 'webgl'
  const canvas = document.createElement('canvas')
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext('webgl2', {
      ...GL_ATTRS,
      failIfMajorPerformanceCaveat: !forced,
    }) as WebGL2RenderingContext | null
  } catch {
    gl = null
  }
  if (!gl) return null
  const renderer = rendererString(gl)
  if (!forced && SOFTWARE.test(renderer)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  return { canvas, gl, renderer, forced }
}

/** Touch-first device: the load policy waits for the figure, and materials go standard. */
export const coarsePointer = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (hover: none)').matches
