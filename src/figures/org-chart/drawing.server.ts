import 'server-only'
import { graphBuilder, type StateSpec } from '@/drawings/render'
import { orgChartGraph } from '@/drawings/views/org-chart'

/**
 * The org-chart drawing files served by /drawings/[file] (owner: home-about):
 * the usual chain in pencil on paper, ours in CAD on blueprint-deep.
 */
export const ORG_CHART_STATES: readonly StateSpec[] = [
  { rev: 'chain', medium: 'pencil', ground: 'paper' },
  { rev: 'ours', medium: 'cad', ground: 'deep' },
]

export const drawing = graphBuilder(orgChartGraph, ORG_CHART_STATES)
