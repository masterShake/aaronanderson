import s from './blueprint.module.css'

const LETTERS = 'ABCDEFGHIJKL'

/**
 * Column grid bubbles A to L, one per page-grid column (4, 8 or 12 show by
 * breakpoint). Page heads and the hero only; decorative and aria-hidden.
 */
export function GridBubbles({ columns = 12 }: { columns?: 12 }) {
  return (
    <div className={s.bubbles} aria-hidden="true">
      {LETTERS.slice(0, columns)
        .split('')
        .map((l) => (
          <span key={l}>{l}</span>
        ))}
    </div>
  )
}
