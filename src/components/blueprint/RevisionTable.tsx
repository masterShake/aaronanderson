import s from './blueprint.module.css'

/** A revision table (REV / DATE / CHANGE, or the process columns): a real table with a caption. */
export function RevisionTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: readonly string[]
  rows: readonly (readonly string[])[]
}) {
  return (
    <div className="scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className={s.table} data-revisions="">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        {rows.length ? (
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={j}>{c}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        ) : null}
      </table>
    </div>
  )
}
