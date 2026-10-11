import s from './blueprint.module.css'

const LETTERS = 'ABCDEFGHIJKL'

/** Column grid bubbles A to L. Page heads and the hero only; decorative. */
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
