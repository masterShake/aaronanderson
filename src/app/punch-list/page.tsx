import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as content from '@/content'
import { holdRegistry, isConfirm, isHold } from '@/content/hold'
import { preview } from '@/content/pages/preview'
import { site } from '@/content/site'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { PageHead } from '@/components/blueprint/PageHead'

export const metadata: Metadata = pageMetadata('punch-list')

// Every content module registers its holds when loaded; keep the import live.
void content

/** Preview only: every open HOLD and pending CONFIRM (W0 stub; owner: platform lane). */
export default function PunchListPage() {
  if (!PREVIEW_PAGES) notFound()
  const c = preview.punchList
  const all = holdRegistry()
  const holds = all.filter(isHold)
  const groups = [
    {
      title: c.essential,
      rows: holds.filter((h) => h.essential).map((h) => [h.id, h.note, h.kind]),
    },
    {
      title: c.optional,
      rows: holds.filter((h) => !h.essential).map((h) => [h.id, h.note, h.kind]),
    },
    {
      title: c.pending,
      rows: all
        .filter(isConfirm)
        .filter((k) => k.status === 'pending')
        .map((k) => [k.id, typeof k.value === 'string' ? k.value : JSON.stringify(k.value), '']),
    },
  ]
  return (
    <SheetTransition>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={c.h1} deck={c.deck} />
      {groups.map((g, i) => (
        <section key={g.title} aria-labelledby={`pl-${i}`} className="wrap">
          <h2 id={`pl-${i}`}>{g.title}</h2>
          {g.rows.length ? (
            <table>
              <thead>
                <tr>
                  {c.columns.map((col) => (
                    <th key={col} scope="col">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r[0]}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{c.empty}</p>
          )}
        </section>
      ))}
    </SheetTransition>
  )
}
