import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * axe for the a11y matrix: the WCAG 2.0–2.2 A and AA tags (wcag22aa turns on
 * target-size), with the third-party Cal.com and Turnstile iframes left out.
 * W1 fails on serious or critical; A11Y_STRICT=1 (W2 on) fails on any impact.
 */

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const

const EXCLUDE = [
  'iframe[src*="cal.com"]',
  'iframe[src*="calendly.com"]',
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[title*="Turnstile" i]',
]

export const STRICT = process.env.A11Y_STRICT === '1'

export interface Finding {
  id: string
  impact: string
  help: string
  nodes: { target: string; html: string; summary: string }[]
}

export async function axe(page: Page): Promise<Finding[]> {
  let b = new AxeBuilder({ page }).withTags([...AXE_TAGS])
  for (const sel of EXCLUDE) b = b.exclude(sel)
  const r = await b.analyze()
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? 'unknown',
    help: v.help,
    nodes: v.nodes.slice(0, 8).map((n) => ({
      target: n.target.join(' '),
      html: n.html.slice(0, 200),
      summary: (n.failureSummary ?? '').slice(0, 300),
    })),
  }))
}

/** The findings that fail this wave: serious and critical, or all of them with A11Y_STRICT=1. */
export const failing = (f: Finding[]) =>
  STRICT ? f : f.filter((v) => v.impact === 'serious' || v.impact === 'critical')

/** One line per finding, for assertion messages. */
export const describe = (f: Finding[]) =>
  f.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target ?? ''}`)
