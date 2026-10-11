/** The five sheets and their H1s (from src/content), plus the test matrix. */
export const ROUTES = [
  { path: '/', h1: /wired to run itself/i },
  { path: '/services', h1: /services, drawn to scale/i },
  { path: '/how-it-works', h1: /measure twice/i },
  { path: '/about', h1: /small on purpose/i },
  { path: '/contact', h1: /pick a time/i },
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
