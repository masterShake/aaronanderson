import { DUR, EASE, FLOW, GATE, PENCIL } from './timing/global'

/**
 * Serializes the shared timing tables into CSS custom properties, so CSS and
 * TypeScript read the same numbers. The root layout renders `timingCss` into
 * <style id="ae-timing">. Durations get ms; speeds, counts and ratios stay unitless.
 */

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Keys whose values are durations in ms (everything else is unitless). */
const MS_KEYS = new Set([
  'strokeMin',
  'strokeMax',
  'staggerMin',
  'staggerMax',
  'jitter',
  'note',
  'pop',
  'loop',
  'packetEvery',
  'cssAutoStart',
  'handoffDeadline',
])

function decls(prefix: string, obj: Readonly<Record<string, string | number>>, ms: boolean) {
  return Object.entries(obj)
    .map(([k, v]) => {
      const value = typeof v === 'number' && (ms || MS_KEYS.has(k)) ? `${v}ms` : String(v)
      return `--${prefix}-${kebab(k)}:${value}`
    })
    .join(';')
}

export const timingCss = `:root{${[
  decls('ease', EASE, false),
  decls('dur', DUR, true),
  decls('pencil', PENCIL, false),
  decls('flow', FLOW, false),
  decls('gate', GATE, false),
].join(';')}}`

/**
 * A figure's own timing variables, for FigureFrame's `vars` prop.
 * cssVars(HERO, 'hero') gives { '--hero-scan-start': '1750ms', … }. Keys ending
 * in Speed, P or count-like names stay unitless; everything else numeric gets ms.
 */
export function cssVars(
  obj: Readonly<Record<string, string | number>>,
  prefix: string,
): Record<`--${string}`, string> {
  const out: Record<`--${string}`, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const unitless = typeof v !== 'number' || /(Speed|P|loops|Every)$/.test(k)
    out[`--${prefix}-${kebab(k)}`] = unitless ? String(v) : `${v}ms`
  }
  return out
}
