import s from './blueprint.module.css'

/**
 * A punch list: items ticked off as they close. The boxes show state only
 * (disabled native checkboxes, so they read as checked or not checked).
 */
export function PunchList({ items }: { items: readonly { text: string; done: boolean }[] }) {
  return (
    <ul className={s.punch}>
      {items.map((it) => (
        <li key={it.text} data-done={it.done}>
          <label>
            <input type="checkbox" checked={it.done} disabled readOnly />
            <span>{it.text}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
