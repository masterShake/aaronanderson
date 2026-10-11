import s from './blueprint.module.css'

/** A section-cut marker: letter over sheet, used as a divider and anchor. */
export function SectionCut({ letter, sheet, id }: { letter: string; sheet: string; id?: string }) {
  return (
    <p className={s.strip} id={id} aria-hidden="true">
      {letter} / {sheet}
    </p>
  )
}
