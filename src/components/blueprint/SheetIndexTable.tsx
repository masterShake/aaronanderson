import Link from 'next/link'
import type { Route } from 'next'
import type { HomeContent, ServiceId } from '@/content/types'
import s from './blueprint.module.css'

/** The Home sheet index: a table whose rows link to each service sheet. */
export function SheetIndexTable({
  rows,
  columns,
  startHere,
  caption,
}: {
  rows: readonly {
    sheet: ServiceId
    service: string
    walkAway: string
    length: string
    href: Route
  }[]
  columns: HomeContent['sheetIndex']['columns']
  startHere: string
  caption?: string
}) {
  return (
    <div className="scroll">
      <table className={s.table}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col">{columns.sheet}</th>
            <th scope="col">{columns.service}</th>
            <th scope="col">{columns.walkAway}</th>
            <th scope="col">{columns.length}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.sheet}>
              <th scope="row">
                {r.sheet}
                {i === 0 ? <span className={s.strip}> · {startHere}</span> : null}
              </th>
              <td>
                <Link href={r.href}>{r.service}</Link>
              </td>
              <td>{r.walkAway}</td>
              <td>{r.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
