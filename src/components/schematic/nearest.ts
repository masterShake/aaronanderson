/**
 * Arrow-key navigation between tool buttons (pages-drawings §3.5): the
 * nearest candidate in the pressed direction, weighting sideways distance
 * twice. Uses live rects, so it works in either family. Null means stay; it
 * never wraps. Pure and DOM-free apart from the rect shape.
 */

export type Dir = 'left' | 'right' | 'up' | 'down'
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function nearest<T>(from: Box, cands: readonly { el: T; r: Box }[], dir: Dir) {
  const cx = from.x + from.width / 2
  const cy = from.y + from.height / 2
  let best: { el: T; r: Box } | null = null
  let bestS = Infinity
  for (const c of cands) {
    const dx = c.r.x + c.r.width / 2 - cx
    const dy = c.r.y + c.r.height / 2 - cy
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy
    if (along <= 4) continue
    const s = along + 2 * (dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx))
    if (s < bestS) {
      bestS = s
      best = c
    }
  }
  return best
}

export const KEY_DIR: Readonly<Record<string, Dir>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}
