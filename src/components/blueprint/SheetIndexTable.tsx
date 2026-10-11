import Link from 'next/link'
import type { Route } from 'next'
import type { HomeContent, ServiceId } from '@/content/types'
import s from './blueprint.module.css'

/**
 * The Home sheet index: a table whose rows link to each service sheet (the
 * service link stretches over the row). A north arrow marks START HERE at the
 * first sheet. Rows stack below 640 px.
 */
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
      <table className={`${s.table} ${s.indexTable}`} data-stack="">
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
            <tr key={r.sheet} data-sheet={r.sheet}>
              <th scope="row">
                {r.sheet}
                {i === 0 ? (
                  <span className={s.startHere}>
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                      />
                      <path d="M8 2.5 11 12 8 10 5 12Z" fill="currentColor" />
                    </svg>
                    {startHere}
                  </span>
                ) : null}
              </th>
              <td data-label={columns.service}>
                <Link href={r.href} className={s.rowLink}>
                  {r.service}
                </Link>
              </td>
              <td data-label={columns.walkAway}>{r.walkAway}</td>
              <td data-label={columns.length}>{r.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
