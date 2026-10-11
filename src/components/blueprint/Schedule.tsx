import type { ReactNode } from 'react'
import s from './blueprint.module.css'

/** A real <table> schedule; rows stack below 640 px when stack is set. */
export function Schedule({
  caption,
  columns,
  rows,
  stack,
}: {
  caption: string
  columns: readonly { key: string; label: string; numeric?: boolean }[]
  rows: readonly Readonly<Record<string, ReactNode>>[]
  stack?: boolean
}) {
  return (
    <div className="scroll">
      <table className={s.table} data-stack={stack ? '' : undefined}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row">
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key} data-label={c.label}>
                    {r[c.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
