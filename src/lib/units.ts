/**
 * Units. Every length in the model is in inches, and every authored value is a multiple of
 * 1/16″ — exact in binary floating point, so geometry built from it compares exactly.
 */
export type Inch = number

/** ½″ gypsum board: finished faces sit this far off the stud faces. */
export const GWB: Inch = 0.5

/** Plan cut height above the subfloor. Anything whose bottom is above it draws as overhead. */
export const CUT_PLANE: Inch = 48

export const ft = (feet: number, inches: Inch = 0): Inch => feet * 12 + inches

export const isSixteenth = (v: number): boolean => Number.isFinite(v) && Number.isInteger(v * 16)

const FRACTIONS: Record<number, string> = { 1: '¼', 2: '½', 3: '¾' }

/**
 * Feet-and-inches the way they appear on a drawing: 12′-4″, 3′-1½″, 9″.
 * `precision` rounds to the inch (room sizes) or to the quarter inch (dimension strings; the
 * label font has ¼ ½ ¾ but no eighths).
 */
export function formatFtIn(inches: Inch, precision: 'inch' | 'quarter' = 'quarter'): string {
  const sign = inches < 0 ? '−' : ''
  const quarters = precision === 'inch' ? Math.round(Math.abs(inches)) * 4 : Math.round(Math.abs(inches) * 4)
  const feet = Math.floor(quarters / 48)
  const rest = quarters - feet * 48
  const whole = Math.floor(rest / 4)
  const frac = FRACTIONS[rest % 4] ?? ''
  const inchPart = `${whole}${frac}″`
  return feet === 0 ? `${sign}${inchPart}` : `${sign}${feet}′-${inchPart}`
}

/** Inches only, to the quarter: 33½″. Code clearances read this way (≥ 32″, ≥ 36″). */
export function formatIn(inches: Inch): string {
  const quarters = Math.round(inches * 4)
  return `${Math.floor(quarters / 4)}${FRACTIONS[quarters % 4] ?? ''}″`
}

/** 12′-4″ × 14′-10″, rounded to the inch. */
export const formatSize = (w: Inch, d: Inch): string =>
  `${formatFtIn(w, 'inch')} × ${formatFtIn(d, 'inch')}`

/** Square feet from square inches. */
export const sqft = (sqIn: number): number => sqIn / 144
