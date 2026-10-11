import { test, expect } from '@playwright/test'
import { holdRegistry, isConfirm, isHold } from '../hold'
import type { Claimable, Held } from '../types'
import { processSteps } from '../process'
import { contact } from '../pages/contact'
import { about } from '../pages/about'
import { servicesPage } from '../pages/services'
import { howItWorks } from '../pages/how-it-works'
import { services, serviceById } from '../services'
import { people } from '../people'
import { seo } from '../seo'
import { site } from '../site'
import { glossary } from '../legend'
import { afterContactFigure } from '../figures/after-contact'
import { s05Figure } from '../figures/s05'
import { s02Figure } from '../figures/s02'
import { strataFigure } from '../figures/strata'
import { orgChartFigure } from '../figures/org-chart'

/**
 * W3 copy findings (copy-2 to copy-16): the copy reads true and whole in
 * production, where a HOLD shows its prodFallback (or nothing) and a pending
 * CONFIRM is left out. No browser.
 */

/** What production renders for a piece of copy, or null when it is left out. */
function prod(v: Claimable | Held): string | null {
  if (typeof v === 'string') return v
  if (isHold(v)) return v.prodFallback
  if (isConfirm(v)) return v.status === 'ok' ? prod(v.value as Claimable) : null
  let text = v.text
  for (const [k, h] of Object.entries(v.vars)) {
    const r = prod(h)
    if (r === null) return null
    text = text.replaceAll(`{${k}}`, r)
  }
  return text
}
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean)

test('copy-2: P-02 promises no fee outside a CONFIRM', () => {
  const p02 = processSteps.find((p) => p.id === 'P-02')!
  for (const line of [p02.weDo, p02.youDo, p02.youGet, p02.youShort, p02.title])
    expect(line).not.toMatch(/\bfee\b/i)
})

test('copy-3: contact copy holds with or without the scheduler', () => {
  const lines = [
    contact.closing.h2,
    prod(contact.closing.body),
    ...(contact.privacy.body ?? []).map(prod),
    ...contact.privacy.processors.map((p) => `${p.name} ${p.does}`),
    seo.contact.description,
    afterContactFigure.ui.sooner,
  ].filter((l): l is string => l !== null)
  for (const l of lines) {
    expect(l).not.toMatch(/pick a time|at the top|show available times|on our calendar|above|↑/i)
    expect(l).not.toMatch(/runs the calendar$/i)
  }
})

test('copy-4: the strata body reads whole with every HOLD on its fallback', () => {
  const shown = (about.strata.body ?? []).map(prod).filter((l): l is string => l !== null)
  expect(shown.length).toBeGreaterThan(0)
  expect(shown[0]).not.toMatch(/^(that|this|it|so)\b/i)
})

test('copy-6: crew roles invent nothing in production; tags are on the punch list', () => {
  for (const p of people.people) {
    expect(isHold(p.role)).toBe(true)
    expect(prod(p.role)).toBeNull()
  }
  const tags = holdRegistry().find((h) => h.id === 'people.tags')
  expect(tags && isHold(tags)).toBe(true)
})

test('copy-8: S-03 explains AI in plain terms everywhere, in two sentences', () => {
  const pt = serviceById('S-03').plainTerms!
  expect(isConfirm(pt)).toBe(false)
  const text = prod(pt)
  expect(text).not.toBeNull()
  expect(sentences(text!).length).toBeLessThanOrEqual(2)
})

test('copy-9: S-05 is tagged as an example firm and its record is SAMPLE', () => {
  expect((s05Figure as { tag?: string }).tag).toBe(site.exampleTag)
  expect(s05Figure.ui.recordTitle).toMatch(/SAMPLE/)
})

test('copy-11: glossary links mid-sentence keep sentence case', () => {
  const caps = new Set<string>(glossary.filter((g) => /^[A-Z][a-z]/.test(g.term)).map((g) => g.id))
  const lines = services.flatMap((s) => [
    ...(s.plainTerms ? [prod(s.plainTerms) ?? ''] : []),
    ...s.examples.map((e) => prod(e) ?? ''),
  ])
  for (const l of lines)
    for (const m of l.matchAll(/(\S)\s+\[\[([a-z-]+)\]\]/g))
      if (!/[.!?]/.test(m[1]!)) expect(caps.has(m[2]!), `${l}`).toBe(false)
})

test('copy-12: each fact said once where it sits', () => {
  for (const s of services) {
    if (!('weeks' in s.shape.span)) continue
    const summary = (prod(s.shape.summary) ?? '').toLowerCase()
    const len = s.lengthLabel.toLowerCase()
    expect(summary, s.id).not.toContain(len)
    expect(summary, s.id).not.toContain(len.split(',')[0]!.split(' per ')[0]!)
  }
  for (const l of (contact.privacy.body ?? []).map(prod))
    expect(l ?? '').not.toMatch(/Resend|Cal\.com/)
  for (const l of howItWorks.ticket.body ?? []) expect(prod(l) ?? '').not.toMatch(/Scale 1:1/)
})

test('copy-13: length cells say a length; pricing cells use one phrase', () => {
  expect(servicesPage.schedule.chart.sessions).toMatch(/few sessions/i)
  const phrases = [
    servicesPage.schedule.quoted,
    ...services.map((s) => (s.shape.price ? prod(s.shape.price.value) : null)),
  ].filter((p): p is string => p !== null)
  for (const p of phrases) expect(p).toMatch(/quoted on the first call$/i)
})

test('copy-14: About details are numbered in reading order', () => {
  expect(strataFigure.detail).toBe('DETAIL 1 / G-02')
  expect(orgChartFigure.detail).toBe('DETAIL 2 / G-02')
})

test('copy-16: S-02 counts its places in words', () => {
  expect(s02Figure.ui.arrives).toContain('{places:word}')
})
