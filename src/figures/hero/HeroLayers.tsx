import type { Layer, LayoutId, SvgDoc, SvgNode } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'
import { layerClass } from '@/figures/types'

/**
 * The hero's stacked layer <svg>s, both families (the container query shows one). The hero is
 * the only inline drawing and its markup is repeated by the RSC payload, so it is written
 * compactly: the class vocabulary of lib/svg-string, but pathLength="1" and --len only on the
 * paths that use them (draw-on and packets), --i only where it is not 0, and no data-part.
 * `prefix` replaces the l-{layer} class for the still tier's inset, so no figure rule or
 * Stage query ever mistakes it for a live layer.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** A number to at most two decimals, without float noise or a leading zero's sign games. */
const num = (v: number) => String(Math.round(v * 100) / 100)

/**
 * Path data in relative commands (the inline budget): the same points, written as offsets, with
 * H/V for axis moves and repeated commands implied. Exact to 0.01 unit (every input point is at
 * most two decimals), so the CAD plan still meets the 3D hand-off frame pixel for pixel.
 * Path data with commands other than M L H V C Z (absolute or relative) is left as it is.
 */
export function compactD(d: string): string {
  if (/[^MLHVCZmlhvcz\d\s.,eE+-]/.test(d)) return d
  const toks = d.match(/[MLHVCZmlhvcz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)
  if (!toks) return d
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  let last = ''
  let out = ''
  let i = 0
  const n = () => Number(toks[i++])
  const emit = (c: string, vals: number[]) => {
    const body = vals.map(num).join(' ')
    out += c === last ? `${/^-/.test(body) ? '' : ' '}${body}` : `${c}${body}`
    // never continue a moveto: the first one is written absolute, and its implied linetos
    // would be too
    last = c === 'm' ? '' : c
  }
  while (i < toks.length) {
    const t = toks[i]!
    if (/[A-Za-z]/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') {
        out += 'z'
        last = 'z'
        x = sx
        y = sy
        continue
      }
    }
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'M' || C === 'L') {
      const nx = n() + (rel ? x : 0)
      const ny = n() + (rel ? y : 0)
      const dx = nx - x
      const dy = ny - y
      if (C === 'M') {
        emit('m', [dx, dy])
        sx = nx
        sy = ny
        // further pairs after a moveto are linetos
        cmd = rel ? 'l' : 'L'
      } else if (Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005) {
        // a zero-length segment draws nothing
      } else if (Math.abs(dy) < 0.005) emit('h', [dx])
      else if (Math.abs(dx) < 0.005) emit('v', [dy])
      else emit('l', [dx, dy])
      x = nx
      y = ny
    } else if (C === 'H') {
      const nx = n() + (rel ? x : 0)
      emit('h', [nx - x])
      x = nx
    } else if (C === 'V') {
      const ny = n() + (rel ? y : 0)
      emit('v', [ny - y])
      y = ny
    } else if (C === 'C') {
      const v = [n(), n(), n(), n(), n(), n()]
      const o = rel ? [0, 0, 0, 0, 0, 0] : [x, y, x, y, x, y]
      emit(
        'c',
        v.map((q, k) => q - o[k]!),
      )
      x = rel ? x + v[4]! : v[4]!
      y = rel ? y + v[5]! : v[5]!
    } else return d
  }
  // the first moveto is absolute either way
  return out.replace(/^m/, 'M').replace(/ -/g, '-')
}

function node(n: SvgNode): string {
  if (n.el === 'g')
    return `<g${n.cls ? ` class="${esc(n.cls)}"` : ''}>${n.children.map(node).join('')}</g>`
  const drawn = /(^|\s)draw(\s|$)/.test(n.cls)
  const dashed = drawn || /(^|\s)pk(\s|$)/.test(n.cls)
  // a draw-on path is one dash of pathLength 1: only the packets' dash pattern reads --len
  const vars = [n.i ? `--i:${n.i}` : '', dashed && !drawn ? `--len:${Math.round(n.len)}` : '']
    .filter(Boolean)
    .join(';')
  return `<path d="${esc(compactD(n.d))}"${dashed ? ' pathLength="1"' : ''} class="${esc(n.cls)}"${vars ? ` style="${vars}"` : ''}/>`
}

/** One layer's markup, or '' when the doc has nothing on it. */
export function heroLayerMarkup(doc: SvgDoc, layer: Layer): string {
  return doc.groups
    .filter((g) => g.layer === layer)
    .map((g) => g.children.map(node).join(''))
    .join('')
}

export function HeroLayers({
  wide,
  tall,
  prefix,
}: {
  wide: SvgDoc
  tall: SvgDoc
  prefix?: string
}) {
  const one = (doc: SvgDoc, family: LayoutId) =>
    LAYERS.map((layer) => {
      const html = heroLayerMarkup(doc, layer)
      if (!html) return null
      return (
        <svg
          key={`${family}-${layer}`}
          className={prefix ? `${prefix} ${prefix}-${layer}` : layerClass(layer)}
          data-family={family}
          viewBox={doc.viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    })
  return (
    <>
      {one(wide, 'wide')}
      {one(tall, 'tall')}
    </>
  )
}
