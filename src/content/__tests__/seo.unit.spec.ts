import { test, expect } from '@playwright/test'
import { seo } from '../seo'
import type { SeoKey } from '../types'

/** SEO copy limits: rendered titles at most 60 characters, descriptions at most 155, all unique. */

const SUFFIX = ' · Actual Engineer'
const keys = Object.keys(seo) as SeoKey[]
const rendered = (k: SeoKey) => (seo[k].absolute ? seo[k].title : seo[k].title + SUFFIX)

test('every rendered title is 60 characters or fewer', () => {
  for (const k of keys) expect(rendered(k).length, `${k}: ${rendered(k)}`).toBeLessThanOrEqual(60)
})

test('every description is 155 characters or fewer', () => {
  for (const k of keys)
    expect(seo[k].description.length, `${k}: ${seo[k].description}`).toBeLessThanOrEqual(155)
})

test('titles and descriptions are unique', () => {
  const titles = keys.map(rendered)
  const descriptions = keys.map((k) => seo[k].description)
  expect(new Set(titles).size).toBe(titles.length)
  expect(new Set(descriptions).size).toBe(descriptions.length)
})

test('OG text is present for every page', () => {
  for (const k of keys) {
    expect(seo[k].og.kicker.length, k).toBeGreaterThan(0)
    expect(seo[k].og.title.length, k).toBeGreaterThan(0)
    expect(seo[k].og.alt.length, k).toBeGreaterThan(0)
  }
})
