import { IntentLink as Link } from '@/components/ui/IntentLink.client'
import type { Route } from 'next'
import type { Graph, Pt } from '@/drawings/types'
import { firmGraph } from '@/drawings/graphs/firm'
import { inRev, nodeRect, routeGraph } from '@/drawings/lib/route'
import { COLOR } from '@/styles/tokens'

/**
 * A key plan: a 120 × 75 px miniature of the Home rewired drawing with the
 * area a detail covers hatched (45°, 3-unit pitch, blueprint). Rendered as an
 * <img> with a baked SVG data URI, so it is static, cached with the page and
 * usable anywhere an image is. Decorative: alt="" and aria-hidden.
 */

const VIEWS: Readonly<Record<string, Graph<string, string>>> = { firm: firmGraph }

/** What each service sheet highlights on the firm (pages-drawings §6.10 d). */
export const KEYPLAN_HIGHLIGHT: Readonly<Record<string, readonly string[]>> = {
  'S-01': ['all'],
  'S-02': ['r01', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10', 'r11', 'r12', 'r14'],
  'S-03': ['r02', 'r03'],
  'S-04': ['store', 'report'],
  'S-05': ['p1', 'p2', 'p3', 'p4'],
  'S-06': ['monitor', 'm06', 'm08', 'm10'],
}

const n0 = (v: number) => Math.round(v)
const poly = (pts: readonly Pt[]) => pts.map((p) => `${n0(p[0])} ${n0(p[1])}`).join('L')

/** The key plan's SVG markup (wide family of the view, rewired rev). */
export function keyPlanSvg(view: string, highlight: readonly string[]): string {
  const g = VIEWS[view] ?? firmGraph
  const rev = g.revs[g.revs.length - 1]!
  const [vx, vy, vw, vh] = g.viewBox.wide
  const all = highlight.includes('all')
  const hl = new Set(highlight)
  const routes = routeGraph(g, rev, 'wide', { bend: 0 })
  const ink = COLOR.blueprint
  const faint = COLOR.pencilFaint
  const boxes: string[] = []
  const hatch: string[] = []
  for (const n of g.nodes) {
    if (!inRev(n, rev)) continue
    const r = nodeRect(n, 'wide')
    const on = all || hl.has(n.id)
    boxes.push(
      `<rect x="${n0(r.x)}" y="${n0(r.y)}" width="${n0(r.w)}" height="${n0(r.h)}" fill="none" stroke="${on ? ink : faint}" stroke-width="${on ? 14 : 10}"/>`,
    )
    if (on)
      hatch.push(
        `<rect x="${n0(r.x)}" y="${n0(r.y)}" width="${n0(r.w)}" height="${n0(r.h)}" fill="url(#h)"/>`,
      )
  }
  for (const p of g.people ?? []) {
    if (!hl.has(p.id)) continue
    const pose = (p.poses as Record<string, { at: Pt } | undefined>)[rev]
    if (pose)
      hatch.push(
        `<circle cx="${n0(pose.at[0])}" cy="${n0(pose.at[1] - 20)}" r="40" fill="url(#h)" stroke="${ink}" stroke-width="10"/>`,
      )
  }
  const lines = [...routes.values()].map((r) => {
    const on = all || hl.has(r.id)
    return `<path d="M${poly(r.pts)}" fill="none" stroke="${on ? ink : faint}" stroke-width="${on ? 16 : 10}"${r.route.kind === 'branch' ? ' stroke-dasharray="30 24"' : ''}/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}"><defs><pattern id="h" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="24" stroke="${ink}" stroke-width="8"/></pattern></defs><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${COLOR.paper}"/>${lines.join('')}${boxes.join('')}${hatch.join('')}</svg>`
}

export function KeyPlan({
  view,
  highlight,
  href,
  size = 120,
}: {
  view: string
  highlight: readonly string[]
  href?: Route
  size?: 120
}) {
  const g = VIEWS[view] ?? firmGraph
  const [, , vw, vh] = g.viewBox.wide
  const height = Math.round((size * vh) / vw)
  const src = `data:image/svg+xml,${encodeURIComponent(keyPlanSvg(view, highlight))}`
  const img = (
    // a baked SVG data URI: next/image would add nothing
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={height}
      data-view={view}
      data-highlight={highlight.join(' ')}
      decoding="async"
      style={{ display: 'block', border: `1px solid ${COLOR.pencilFaint}` }}
    />
  )
  // a decorative duplicate of a labelled link nearby: kept out of the tab order and the tree
  return href ? (
    <Link href={href} aria-hidden="true" tabIndex={-1}>
      {img}
    </Link>
  ) : (
    img
  )
}
