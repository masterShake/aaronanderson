import { COLOR, PEN } from '@/styles/tokens'
import type { Ink, Layer, Pen, SvgDoc, SvgNode, ViewBox } from '../types'
import { LAYERS } from '../types'
import { r2 } from './geometry'

/**
 * SVG serialisation, shared by the /drawings/[file] builders and InlineDrawing.
 *
 * Class vocabulary on every path (the figure CSS maps these to tokens; stills
 * bake them):
 *   p-{pen}     stroke-width calc(var(--pen-{pen}) * var(--k))
 *   i-{ink}     stroke color
 *   f-{ink}     fill color (default none)
 *   draw        a draw-on path (pathLength="1", stroke-dasharray 1 2)
 *   d-{dash}    hand-carry | hidden | center | signal dash patterns (in k units)
 *   cap-sq      square caps (default round)
 * Paths always carry pathLength="1", data-part, and --i (stagger) and --len (user units).
 * No <text>, and strokes are never non-scaling.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function nodeString(n: SvgNode): string {
  if (n.el === 'path')
    return `<path d="${esc(n.d)}" pathLength="1" class="${esc(n.cls)}" data-part="${esc(n.part)}" style="--i:${n.i};--len:${r2(n.len)}"/>`
  const attrs = [
    n.cls ? ` class="${esc(n.cls)}"` : '',
    n.part ? ` data-part="${esc(n.part)}"` : '',
    n.transform ? ` transform="${esc(n.transform)}"` : '',
  ].join('')
  return `<g${attrs}>${n.children.map(nodeString).join('')}</g>`
}

/** The inner markup of one layer: its groups, each tagged with data-layer (and data-rev). */
export function layerMarkup(doc: SvgDoc, layer: Layer): string {
  return doc.groups
    .filter((g) => g.layer === layer)
    .map(
      (g) =>
        `<g data-layer="${layer}"${g.rev ? ` data-rev="${esc(g.rev)}"` : ''}>${g.children.map(nodeString).join('')}</g>`,
    )
    .join('')
}

/** Layers present in a doc, bottom to top. */
export const docLayers = (doc: SvgDoc): Layer[] =>
  LAYERS.filter((l) => doc.groups.some((g) => g.layer === l))

/** A whole doc as one class-based <svg> (all layers stacked), for tests and single-svg uses. */
export function toSvgString(doc: SvgDoc): string {
  const vb = doc.viewBox.map(r2).join(' ')
  const body = docLayers(doc)
    .map((l) => layerMarkup(doc, l))
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${doc.cls ? ` class="${esc(doc.cls)}"` : ''}>${body}</svg>`
}

// Baked stills: the same markup with colors and widths as attributes.

const INK: Readonly<Record<Ink, string>> = {
  pencil: COLOR.pencil,
  graphite: COLOR.graphite,
  cad: COLOR.blueprint,
  cyan: COLOR.cyan,
  'cyan-dim': COLOR.cyanDim,
  redline: COLOR.redline,
  orange: COLOR.orange,
  asphalt: COLOR.asphalt,
  paper: COLOR.paper,
  hold: COLOR.graphite,
}

/** Extra inks for faces and panels (iso print, deep panels). */
const EXTRA: Readonly<Record<string, string>> = {
  'paper-2': COLOR.paper2,
  deep: COLOR.blueprintDeep,
  'alu-100': COLOR.alu100,
  'alu-300': COLOR.alu300,
  'alu-500': COLOR.alu500,
  'alu-700': COLOR.alu700,
  'orange-dark': '#D9551A',
  label: COLOR.labelOnDeep,
}

export const inkColor = (ink: string): string =>
  (INK as Record<string, string>)[ink] ?? EXTRA[ink] ?? COLOR.asphalt

/** Dash patterns in CSS px at k = 1 (multiplied by k, like the live CSS). */
export const DASH: Readonly<Record<string, readonly number[]>> = {
  'hand-carry': [6, 4],
  hidden: [4, 3],
  center: [12, 3, 2, 3],
  signal: [4, 3],
  hold: [6, 4],
}

export interface BakeOptions {
  /** User units per CSS px the still is drawn at (the family's median --k). */
  k: number
  /** Background ink (the panel); omit for transparent. */
  ground?: string
  /** Paint inks remapped for a panel (for example cad → cyan on blueprint-deep). */
  remap?: Readonly<Record<string, string>>
  /** Opacity per layer (for example the ghost at 0.22). */
  opacity?: Partial<Readonly<Record<Layer, number>>>
}

function bakedAttrs(cls: string, o: BakeOptions): string {
  const parts = cls.split(/\s+/)
  let pen: Pen | null = null
  let ink = 'asphalt'
  let fill = 'none'
  let dash: string | null = null
  let square = false
  let extra = ''
  for (const c of parts) {
    if (c.startsWith('p-')) pen = c.slice(2) as Pen
    else if (c.startsWith('i-')) ink = c.slice(2)
    else if (c.startsWith('f-')) fill = c.slice(2)
    else if (c.startsWith('d-')) dash = c.slice(2)
    else if (c === 'cap-sq') square = true
    else if (c === 'o-55') extra = ' opacity="0.55"'
  }
  const color = (i: string) => inkColor(o.remap?.[i] ?? i)
  const w = pen ? r2(PEN[pen] * o.k) : 0
  const out = [
    ` fill="${fill === 'none' ? 'none' : color(fill)}"`,
    pen ? ` stroke="${color(ink)}" stroke-width="${w}"` : ' stroke="none"',
    pen ? ` stroke-linecap="${square ? 'square' : 'round'}" stroke-linejoin="round"` : '',
    extra,
  ]
  const pattern = dash ? DASH[dash] : undefined
  if (pattern) out.push(` stroke-dasharray="${pattern.map((v) => r2(v * o.k)).join(' ')}"`)
  return out.join('')
}

function bakedNode(n: SvgNode, o: BakeOptions): string {
  if (n.el === 'path') return `<path d="${esc(n.d)}"${bakedAttrs(n.cls, o)}/>`
  return `<g${n.transform ? ` transform="${esc(n.transform)}"` : ''}>${n.children.map((c) => bakedNode(c, o)).join('')}</g>`
}

/**
 * A self-contained still: colors and stroke widths baked in, no classes, no
 * text, no scripts. Used by <img loading=lazy> and <noscript>.
 */
export function toStillSvg(doc: SvgDoc, o: BakeOptions, layers?: readonly Layer[]): string {
  const vb: ViewBox = doc.viewBox
  const [x, y, w, h] = vb.map(r2)
  const keep = layers ?? docLayers(doc)
  const ground = o.ground
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${inkColor(o.ground)}"/>`
    : ''
  const body = LAYERS.filter((l) => keep.includes(l))
    .map((l) => {
      const inner = doc.groups
        .filter((g) => g.layer === l)
        .map((g) => g.children.map((c) => bakedNode(c, o)).join(''))
        .join('')
      if (!inner) return ''
      const op = o.opacity?.[l]
      return `<g${op !== undefined ? ` opacity="${op}"` : ''}>${inner}</g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${ground}${body}</svg>`
}
