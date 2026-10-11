import { about } from '../src/content/pages/about'
import { contact } from '../src/content/pages/contact'
import { home } from '../src/content/pages/home'
import { howItWorks } from '../src/content/pages/how-it-works'
import { servicesPage } from '../src/content/pages/services'

/**
 * Turns an H1 from content into a pattern that ignores case and spacing, so the
 * copy can change without anyone touching the tests.
 */
const heading = (text: string) =>
  new RegExp(
    text
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+'),
    'i',
  )

/** The five sheets and their H1s (read from src/content), plus the test matrix. */
export const ROUTES = [
  { path: '/', h1: heading(home.hero.h1) },
  { path: '/services', h1: heading(servicesPage.h1) },
  { path: '/how-it-works', h1: heading(howItWorks.h1) },
  { path: '/about', h1: heading(about.h1) },
  { path: '/contact', h1: heading(contact.h1) },
] as const

export const TIERS = ['still', 'svg', 'webgl'] as const
export const WIDTHS = [360, 375, 390, 768, 1280, 1440] as const

export type Tier = (typeof TIERS)[number]

/** Narrow the matrix from the environment: ROUTES=/,/about TIERS=still WIDTHS=390,1280. */
export const pick = <T>(all: readonly T[], env: string | undefined, parse: (s: string) => T) =>
  env
    ? env
        .split(',')
        .map(parse)
        .filter((v) => all.includes(v))
    : [...all]
