import type { Prim, Pt } from '@/drawings/types'

/**
 * Single-stroke drafting lettering (owner: howcontact), for the ticket's baked
 * phone stills only: an <img> still has no HTML labels and no web fonts, and
 * stills carry no <text>, so names are drawn as pen strokes, the way a
 * drafter letters a sheet. Capitals on a 4 × 6 grid (y down), straight
 * strokes with chamfered corners. Strings come from src/content; this file
 * has none.
 */

const G: Readonly<Record<string, readonly string[]>> = {
  A: ['0,6 2,0 4,6', '0.7,4 3.3,4'],
  B: ['0,0 0,6 3,6 4,5 4,4 3,3 0,3', '0,0 3,0 4,1 4,2 3,3'],
  C: ['4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5'],
  D: ['0,0 0,6 3,6 4,5 4,1 3,0 0,0'],
  E: ['4,0 0,0 0,6 4,6', '0,3 3,3'],
  F: ['4,0 0,0 0,6', '0,3 3,3'],
  G: ['4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.5 2.4,3.5'],
  H: ['0,0 0,6', '4,0 4,6', '0,3 4,3'],
  I: ['2,0 2,6', '1,0 3,0', '1,6 3,6'],
  J: ['4,0 4,5 3,6 1,6 0,5'],
  K: ['0,0 0,6', '4,0 0,4', '1.33,2.67 4,6'],
  L: ['0,0 0,6 4,6'],
  M: ['0,6 0,0 2,3.5 4,0 4,6'],
  N: ['0,6 0,0 4,6 4,0'],
  O: ['1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0'],
  P: ['0,6 0,0 3,0 4,1 4,2 3,3 0,3'],
  Q: ['1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', '2.4,4.4 4,6'],
  R: ['0,6 0,0 3,0 4,1 4,2 3,3 0,3', '2,3 4,6'],
  S: ['4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5'],
  T: ['0,0 4,0', '2,0 2,6'],
  U: ['0,0 0,5 1,6 3,6 4,5 4,0'],
  V: ['0,0 2,6 4,0'],
  W: ['0,0 1,6 2,2.5 3,6 4,0'],
  X: ['0,0 4,6', '4,0 0,6'],
  Y: ['0,0 2,3 4,0', '2,3 2,6'],
  Z: ['0,0 4,0 0,6 4,6'],
  '0': ['1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0'],
  '1': ['1,1 2,0 2,6', '1,6 3,6'],
  '2': ['0,1 1,0 3,0 4,1 4,2 0,6 4,6'],
  '3': ['0,1 1,0 3,0 4,1 4,2 3,3 4,4 4,5 3,6 1,6 0,5', '1.5,3 3,3'],
  '4': ['3,6 3,0 0,4 4,4'],
  '5': ['4,0 0,0 0,3 3,3 4,4 4,5 3,6 1,6 0,5'],
  '6': ['3.5,0 1,0 0,1 0,5 1,6 3,6 4,5 4,4 3,3 0,3'],
  '7': ['0,0 4,0 1.5,6'],
  '8': ['1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0', '1,3 3,3 4,4 4,5 3,6 1,6 0,5 0,4 1,3'],
  '9': ['0.5,6 3,6 4,5 4,1 3,0 1,0 0,1 0,2 1,3 4,3'],
  '·': ['1.9,3 2.1,3'],
  '-': ['1,3.3 3,3.3'],
  ',': ['1.6,5.4 1.6,6 1,7'],
  '.': ['1.8,5.8 2.2,5.8'],
  '?': ['0,1 1,0 3,0 4,1 4,2 2,3.4 2,4.3', '2,5.8 2,6'],
  '→': ['0,3 4,3', '2.4,1.6 4,3 2.4,4.4'],
  '✓': ['0,3.4 1.4,5.4 4,0.8'],
}

/** Advance per character in grid units (4 wide plus spacing). */
const ADV = 6

/** Width of a line of lettering at cap height `cap`. */
export const measure = (text: string, cap: number) =>
  Math.max(0, text.length * ADV - (ADV - 4)) * (cap / 6)

/** Break text into lines between words so each fits `max` user units. */
export function wrap(text: string, max: number, cap: number): string[] {
  const lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && measure(`${last} ${word}`, cap) <= max)
      lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/** One line of lettering, top-left at (x, y), as polylines. Unknown characters leave a gap. */
export function letter(text: string, x: number, y: number, cap: number): Prim[] {
  const s = cap / 6
  const out: Prim[] = []
  const up = text.toUpperCase()
  for (let i = 0; i < up.length; i++) {
    const strokes = G[up[i]!]
    if (!strokes) continue
    const ox = x + i * ADV * s
    for (const st of strokes) {
      const pts = st.split(' ').map((p): Pt => {
        const [a, b] = p.split(',').map(Number)
        return [Math.round((ox + a! * s) * 100) / 100, Math.round((y + b! * s) * 100) / 100]
      })
      out.push({ t: 'poly', pts })
    }
  }
  return out
}

/** A block of lines, `gap` apart (top to top is cap + gap). */
export function letterLines(
  lines: readonly string[],
  x: number,
  y: number,
  cap: number,
  gap = cap * 0.6,
): Prim[] {
  return lines.flatMap((l, i) => letter(l, x, y + i * (cap + gap), cap))
}
