import type { ReactNode } from 'react'
import s from './blueprint.module.css'

/** A spec grid: We do / You do / How long / You get. */
export function SpecGrid({ cells }: { cells: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className={s.spec}>
      {cells.map((c) => (
        <div key={c.label}>
          <dt>{c.label}</dt>
          <dd>{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}
