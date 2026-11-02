/**
 * Splicing long runs (plates, rims, girder plies, beams) from stock lengths. Joints may only fall
 * on candidate positions, typically stud or post centres so both ends bear and get nailed.
 */
import { PLATE_LAP } from '@/lib/framing/spec'
import type { Inch } from '@/lib/units'

/**
 * Joint positions that cut [a, b] into the fewest pieces no longer than `stock`, then the
 * shortest longest piece. Joints stay at least `gap` from every position in `avoid` (R602.3.2's
 * 24″ offset between top-plate and cap joints). Ties keep the earlier joint. Throws if no layout
 * exists.
 */
export function chooseJoints(
  a: Inch,
  b: Inch,
  stock: Inch,
  candidates: readonly Inch[],
  avoid: readonly Inch[] = [],
  gap: Inch = PLATE_LAP,
): Inch[] {
  if (b - a <= stock) return []
  const inner = [...new Set(candidates)]
    .filter((c) => c > a && c < b && avoid.every((x) => Math.abs(c - x) >= gap))
    .sort((p, q) => p - q)
  const pts = [a, ...inner, b]
  // Shortest path: (piece count, longest piece) is monotone along a path, so best prefixes extend.
  const count = pts.map(() => Infinity)
  const longest = pts.map(() => Infinity)
  const prev = pts.map(() => -1)
  count[0] = 0
  longest[0] = 0
  for (let j = 1; j < pts.length; j++)
    for (let i = 0; i < j; i++) {
      const piece = pts[j] - pts[i]
      if (piece > stock || count[i] === Infinity) continue
      const n = count[i] + 1
      const m = Math.max(longest[i], piece)
      if (n < count[j] || (n === count[j] && m < longest[j])) {
        count[j] = n
        longest[j] = m
        prev[j] = i
      }
    }
  const last = pts.length - 1
  if (count[last] === Infinity)
    throw new Error(
      `Cannot splice ${b - a}″ from ${stock}″ stock with joints on [${inner.join(', ')}]`,
    )
  const joints: Inch[] = []
  for (let i = prev[last]; i > 0; i = prev[i]) joints.unshift(pts[i])
  return joints
}

/** The pieces [a, j1], [j1, j2], …, [jn, b]. */
export function piecesBetween(
  a: Inch,
  b: Inch,
  joints: readonly Inch[],
): (readonly [Inch, Inch])[] {
  const cuts = [a, ...joints, b]
  return cuts.slice(1).map((x, i) => [cuts[i], x] as const)
}
