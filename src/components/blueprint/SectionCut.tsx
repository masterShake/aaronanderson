import s from './blueprint.module.css'

/**
 * A section-cut marker: a split bubble (letter over sheet) on a heavy
 * chain-dash cut line. A divider and an anchor target; decorative.
 */
export function SectionCut({ letter, sheet, id }: { letter: string; sheet: string; id?: string }) {
  return (
    <div className={s.cut} id={id} aria-hidden="true">
      <span className={s.cutBubble}>
        <span>{letter}</span>
        <span>{sheet}</span>
      </span>
      <span className={s.cutLine} />
    </div>
  )
}
