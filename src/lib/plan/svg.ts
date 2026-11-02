/**
 * renderPlanSvg(plan): the finished sheet as a standalone SVG, from the same primitives the
 * WebGL layers use. Served at /drawings/a-101.svg as the no-WebGL poster, and handy for checking
 * geometry by eye. AI markup and the test fits are left out (they are gone by sign-off).
 */
import type { Vec2 } from '@/lib/geom/rect'
import { PALETTE, PENS, type PenId } from '@/lib/plan/pens'
import type { PlanDrawing } from '@/lib/plan/types'

const SKIP_PENS = new Set<PenId>(['ai', 'ai-bold', 'ai-dash', 'guide'])
const EM = { name: 11, size: 9, dim: 9, tag: 9, note: 9 } as const

export function renderPlanSvg(plan: PlanDrawing): string {
  const [x0, y0, x1, y1] = plan.box.drawing
  const W = x1 - x0
  const H = y1 - y0
  // Plan y points up, SVG y points down.
  const X = (x: number) => +(x - x0).toFixed(3)
  const Y = (y: number) => +(y1 - y).toFixed(3)
  const pt = ([x, y]: Vec2) => `${X(x)} ${Y(y)}`

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<rect width="${W}" height="${H}" fill="${PALETTE.paper}"/>`,
  ]

  for (const kind of ['poche', 'solid'] as const) {
    const d = plan.fills
      .filter((f) => f.kind === kind)
      .map((f) => `M${f.poly.map(pt).join('L')}Z`)
      .join('')
    if (d) out.push(`<path d="${d}" fill="${kind === 'poche' ? PALETTE.poche : PALETTE.ink}"/>`)
  }

  const byPen = new Map<PenId, string[]>()
  for (const s of plan.strokes) {
    if (s.group || SKIP_PENS.has(s.pen)) continue
    byPen.set(s.pen, [...(byPen.get(s.pen) ?? []), `M${s.pts.map(pt).join('L')}`])
  }
  for (const [pen, paths] of byPen) {
    const p = PENS[pen]
    const dash = p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''
    out.push(
      `<path d="${paths.join('')}" fill="none" stroke="${PALETTE[p.color]}" stroke-width="${p.width[0]}" ` +
        `vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"${dash}/>`,
    )
  }

  out.push(`<g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-stretch="condensed" font-weight="500">`)
  for (const l of plan.labels) {
    const anchor = l.anchor.x === 'center' ? 'middle' : l.anchor.x === 'left' ? 'start' : 'end'
    const baseline = l.anchor.y === 'top' ? 'hanging' : l.anchor.y === 'bottom' ? 'text-after-edge' : 'central'
    const rot = l.rot === 90 ? ` transform="rotate(-90 ${X(l.at[0])} ${Y(l.at[1])})"` : ''
    out.push(
      `<text x="${X(l.at[0])}" y="${Y(l.at[1])}" font-size="${EM[l.size]}" fill="${PALETTE[l.color]}" ` +
        `text-anchor="${anchor}" dominant-baseline="${baseline}"${rot}>${escapeXml(l.text)}</text>`,
    )
  }
  out.push('</g></svg>')
  return out.join('\n')
}

const escapeXml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
