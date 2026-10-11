import type { LayoutId, ModelPart, ModelSpec, Prim, Pt } from '@/drawings/types'
import { heroGraph, type HeroTool } from '@/drawings/views/hero'
import { center, instrumentsOn, nodeRect, routeGraph } from '@/drawings/lib/route'
import { isConnection } from '@/drawings/lib/counts'

/**
 * The firm model (stage-hero §3.3): the hero's rewired plan as a ModelSpec, so the CAD
 * hand-off frame (planFrame), the build-time iso print and the 3D scene all draw the same
 * parts. Isomorphic, and used only at build time and in tests: the scenes read the
 * precomputed copy in ./data.ts (no lib/route or lib/frame in a scene chunk).
 *
 * Plan (x, y) is world (x, 0, y). Depths are in viewBox units.
 */

export const HERO_MODEL = {
  wide: { tool: 44, store: 96, pipe: 9, pipeZ: 14, ai: 22, aiR: 15, valve: 18, bend: 12 },
  tall: { tool: 30, store: 70, pipe: 7, pipeZ: 11, ai: 16, aiR: 11, valve: 14, bend: 10 },
} as const

/** Routes the packets run on, source to sink, in emission order (field, held, lead, ticket). */
export const HERO_FLOW = ['r01', 'r02', 'r05', 'r03', 'r09', 'r08', 'r10', 'r11'] as const

/** The bow-tie valve (two triangles, tip to tip) centred at c, w × h. */
export function bowTie(c: Pt, w: number, h: number): Prim[] {
  const [x, y] = c
  const r = (p: Pt): Pt => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]
  return [
    {
      t: 'poly',
      pts: [r([x - w / 2, y - h / 2]), r([x, y]), r([x - w / 2, y + h / 2])],
      closed: true,
    },
    {
      t: 'poly',
      pts: [r([x + w / 2, y - h / 2]), r([x, y]), r([x + w / 2, y + h / 2])],
      closed: true,
    },
  ]
}

/** Moves a route end that lands on the store's box onto the tank's circle. */
function onTank(pts: readonly Pt[], c: Pt, r: number, atStart: boolean): Pt[] {
  const out = [...pts]
  const i = atStart ? 0 : out.length - 1
  const p = out[i]!
  const q = out[atStart ? 1 : out.length - 2]!
  if (Math.abs(p[0] - q[0]) < 1e-6) {
    // vertical end segment
    const dx = p[0] - c[0]
    const dy = Math.sqrt(Math.max(0, r * r - dx * dx))
    out[i] = [p[0], Math.round((p[1] > c[1] ? c[1] + dy : c[1] - dy) * 100) / 100]
  } else {
    const dy = p[1] - c[1]
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy))
    out[i] = [Math.round((p[0] > c[0] ? c[0] + dx : c[0] - dx) * 100) / 100, p[1]]
  }
  return out
}

export interface HeroModel {
  spec: ModelSpec
  /** Each flowing route's plan polyline (pipe centre line), keyed by route id. */
  routes: Readonly<Record<string, readonly Pt[]>>
  /** The exception branch (around the valve) of the ticket line, and where it leaves and rejoins. */
  branch: { pts: readonly Pt[]; route: string }
  ai: Pt
  valve: Pt
  store: { c: Pt; r: number }
  /** Rewired people: id, symbol and feet. */
  people: readonly { id: string; symbol: string; at: Pt }[]
}

export function buildHeroModel(family: LayoutId): HeroModel {
  const g = heroGraph(family)
  const vb = g.viewBox.wide
  const M = HERO_MODEL[family]
  const routed = routeGraph(g, 'rewired', 'wide', { bend: M.bend })
  const parts: ModelPart[] = []
  const storeNode = g.nodes.find((n) => n.id === 'store')!
  const src = nodeRect(storeNode, 'wide')
  const sc = center(src)
  const sr = Math.min(src.w, src.h) / 2
  for (const n of g.nodes) {
    if (n.id === 'store') continue
    const rc = nodeRect(n, 'wide')
    parts.push({
      id: n.id,
      kind: 'box',
      prims: [{ t: 'rect', at: [rc.x, rc.y], size: [rc.w, rc.h] }],
      depth: M.tool,
      material: (n.id as HeroTool) === 'report' ? 'orange' : 'aluminum',
      anchor: n.label,
    })
  }
  parts.push({
    id: 'store',
    kind: 'tank',
    prims: [{ t: 'circle', c: sc, r: sr }],
    depth: M.store,
    material: 'aluminum',
    anchor: 'sym.store',
  })
  const routes: Record<string, Pt[]> = {}
  let ai: Pt = [0, 0]
  let valve: Pt = [0, 0]
  let branch: Pt[] = []
  for (const r of routed.values()) {
    if (!isConnection(r.route)) continue
    let pts = [...r.pts]
    if (r.from === 'store') pts = onTank(pts, sc, sr, true)
    if (r.to === 'store') pts = onTank(pts, sc, sr, false)
    routes[r.id] = pts
    const ins = instrumentsOn({ ...r, pts })
    const prims: Prim[] = [{ t: 'poly', pts, r: M.bend }]
    if (ins.branch) {
      branch = [...ins.branch]
      prims.push({ t: 'poly', pts: branch, r: M.bend / 2 })
    }
    parts.push({
      id: r.id,
      kind: 'pipe',
      prims,
      depth: M.pipe,
      z: M.pipeZ - M.pipe / 2,
      material: 'aluminum',
    })
    if (ins.ai) ai = ins.ai.at
    if (ins.valve) valve = ins.valve.at
  }
  parts.push({
    id: 'ai',
    kind: 'cyl',
    prims: [{ t: 'circle', c: ai, r: M.aiR }],
    depth: M.ai,
    material: 'aluminum',
    anchor: 'sym.ai',
  })
  parts.push({
    id: 'valve',
    kind: 'valve',
    prims: bowTie(valve, family === 'wide' ? 30 : 24, family === 'wide' ? 18 : 14),
    depth: M.valve,
    material: 'orange',
    anchor: 'sym.valve',
  })
  const people = (g.people ?? []).flatMap((p) => {
    const pose = p.poses.rewired
    return pose ? [{ id: p.id, symbol: pose.symbol, at: pose.at }] : []
  })
  return {
    spec: { id: `hero-${family}`, layout: family, viewBox: vb, start: 'plan', parts },
    routes,
    branch: { pts: branch, route: 'r02' },
    ai,
    valve,
    store: { c: sc, r: sr },
    people,
  }
}
