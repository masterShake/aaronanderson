/**
 * The subset of troika-three-text 0.52 used here. The package ships no `types` entry, and its
 * generated declarations don't model Text as a three Mesh.
 */
declare module 'troika-three-text' {
  import type { Color, Material, Mesh } from 'three'

  export interface TextRenderInfo {
    /** [minX, minY, maxX, maxY] of the laid-out block in local units. */
    blockBounds: [number, number, number, number]
    visibleBounds: [number, number, number, number]
  }

  export class Text extends Mesh {
    text: string
    font: string | null
    fontSize: number
    anchorX: number | 'left' | 'center' | 'right'
    anchorY: number | 'top' | 'top-baseline' | 'top-cap' | 'top-ex' | 'middle' | 'bottom-baseline' | 'bottom'
    letterSpacing: number
    color: string | number | Color | null
    fillOpacity: number
    clipRect: [number, number, number, number] | null
    sdfGlyphSize: number | null
    /** Base material the text's SDF material derives from. */
    material: Material
    readonly textRenderInfo: TextRenderInfo | null
    sync(callback?: () => void): void
    dispose(): void
  }

  export function configureTextBuilder(config: {
    defaultFontURL?: string
    sdfGlyphSize?: number
    useWorker?: boolean
    unicodeFontsURL?: string
  }): void

  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void,
  ): void
}
