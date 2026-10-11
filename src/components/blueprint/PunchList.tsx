import s from './blueprint.module.css'

/** A punch list: items ticked off as they close. */
export function PunchList({ items }: { items: readonly { text: string; done: boolean }[] }) {
  return (
    <ul className={s.notes}>
      {items.map((it) => (
        <li key={it.text} data-done={it.done}>
          <input type="checkbox" checked={it.done} readOnly aria-label={it.text} /> {it.text}
        </li>
      ))}
    </ul>
  )
}
