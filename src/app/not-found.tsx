import type { Metadata } from 'next'
import { notFound } from '@/content/pages/not-found'
import { site } from '@/content/site'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { GridBubbles } from '@/components/blueprint/GridBubbles'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { IntentLink } from '@/components/ui/IntentLink.client'
import { NotFoundFigure } from '@/figures/not-found/NotFoundFigure'
import s from '@/components/chrome/chrome.module.css'

export const metadata: Metadata = pageMetadata('not-found')

/**
 * Sheet not found (D6, §2.6): the strip "SHEET —", the H1 and one line, a
 * static revision cloud around an empty sheet frame, then links to all five
 * sheets and Book a call. Figure left and links right from 1024 px; stacked
 * below. noindex comes from pageMetadata('not-found').
 */
export default function NotFound() {
  return (
    <SheetTransition>
      <div className="wrap">
        <header className={s.notFoundHead} data-sheet="none">
          <GridBubbles />
          <p className={s.errorStrip}>
            {site.sheet.label} — <span aria-hidden="true">·</span> {site.sheet.scale}
          </p>
          <h1 id="not-found-title">{notFound.h1}</h1>
          <p className="lead">{notFound.body}</p>
        </header>
        <div className={s.notFound}>
          <NotFoundFigure />
          <nav aria-labelledby="sheets-title" className={`${s.errorNav} ${s.notFoundLinks}`}>
            <h2 id="sheets-title" className={s.errorLinksTitle}>
              {notFound.links}
            </h2>
            <ul>
              {site.nav.map((it) => (
                <li key={it.page}>
                  <IntentLink href={it.href} className={s.errorLink}>
                    <span className={s.indexSheet}>{it.sheet}</span> {it.label}
                  </IntentLink>
                </li>
              ))}
            </ul>
            <div className={s.errorActions}>
              <BookCallButton />
            </div>
          </nav>
        </div>
      </div>
    </SheetTransition>
  )
}
