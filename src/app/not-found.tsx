import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from '@/content/pages/not-found'
import { site } from '@/content/site'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { PageHead } from '@/components/blueprint/PageHead'
import { NotFoundFigure } from '@/figures/not-found/NotFoundFigure'

export const metadata: Metadata = pageMetadata('not-found')

/** Sheet not found: a static revision cloud and links to all five sheets (owner: kit lane). */
export default function NotFound() {
  return (
    <SheetTransition>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={notFound.h1} deck={notFound.body} />
      <section id="sheets" aria-labelledby="sheets-title" className="wrap">
        <h2 id="sheets-title">{notFound.links}</h2>
        <ul>
          {site.nav.map((it) => (
            <li key={it.page}>
              <Link href={it.href}>
                {it.sheet} · {it.label}
              </Link>
            </li>
          ))}
        </ul>
        <NotFoundFigure />
      </section>
    </SheetTransition>
  )
}
