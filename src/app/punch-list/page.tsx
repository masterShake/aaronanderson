import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as content from '@/content'
import * as afterContact from '@/content/figures/after-contact'
import * as firm from '@/content/figures/firm'
import * as hero from '@/content/figures/hero'
import * as notFoundFig from '@/content/figures/not-found'
import * as orgChart from '@/content/figures/org-chart'
import * as s01 from '@/content/figures/s01'
import * as s02 from '@/content/figures/s02'
import * as s03 from '@/content/figures/s03'
import * as s04 from '@/content/figures/s04'
import * as s05 from '@/content/figures/s05'
import * as s06 from '@/content/figures/s06'
import * as strata from '@/content/figures/strata'
import * as ticket from '@/content/figures/ticket'
import * as valve from '@/content/figures/valve'
import { holdRegistry, isConfirm, isHold } from '@/content/hold'
import { preview } from '@/content/pages/preview'
import { site } from '@/content/site'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { PageHead } from '@/components/blueprint/PageHead'

/** noindex, and never in the sitemap; production returns 404. */
export const metadata: Metadata = pageMetadata('punch-list')

// Every content module registers its holds when it loads, so keep all of them
// live, figure copy included (figure modules are not in '@/content').
void [content, afterContact, firm, hero, notFoundFig, orgChart, strata, ticket, valve]
void [s01, s02, s03, s04, s05, s06]

type Row = readonly [id: string, what: string, kind: string]
const byId = (a: Row, b: Row) => a[0].localeCompare(b[0])

/** Preview only: every open HOLD and pending CONFIRM, the same list as `npm run punchlist`. */
export default function PunchListPage() {
  if (!PREVIEW_PAGES) notFound()
  const c = preview.punchList
  const all = holdRegistry()
  const holds = all.filter(isHold)
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: c.essential,
      rows: holds
        .filter((h) => h.essential)
        .map((h): Row => [h.id, h.note, h.kind])
        .sort(byId),
    },
    {
      title: c.optional,
      rows: holds
        .filter((h) => !h.essential)
        .map((h): Row => [h.id, h.note, h.kind])
        .sort(byId),
    },
    {
      title: c.pending,
      rows: all
        .filter(isConfirm)
        .filter((k) => k.status === 'pending')
        .map((k): Row => [
          k.id,
          typeof k.value === 'string' ? k.value : JSON.stringify(k.value),
          '',
        ])
        .sort(byId),
    },
  ]
  return (
    <SheetTransition>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={c.h1} deck={c.deck} />
      {groups.map((g, i) => (
        <section key={g.title} aria-labelledby={`pl-${i}`} className="wrap">
          <h2 id={`pl-${i}`}>{g.title}</h2>
          {g.rows.length ? (
            <div
              role="region"
              aria-labelledby={`pl-${i}`}
              tabIndex={0}
              style={{ overflowX: 'auto' }}
            >
              <table aria-labelledby={`pl-${i}`} data-punch-list={i}>
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
                      <th scope="row">
                        <code>{r[0]}</code>
                      </th>
                      <td>{r[1]}</td>
                      <td>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{c.empty}</p>
          )}
        </section>
      ))}
    </SheetTransition>
  )
}
