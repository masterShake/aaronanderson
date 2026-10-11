import type { ReactNode } from 'react'
import type { Rich, SheetId } from '@/content/types'
import { site } from '@/content/site'
import { RichText } from '@/components/ui/RichText'
import { GridBubbles } from './GridBubbles'
import s from './blueprint.module.css'

/**
 * The sheet head: grid bubbles and faint column lines (page heads and the hero
 * only), the mono strip "SHEET S-00 · SERVICES · SCALE: AS NOTED", the page's
 * only H1, and the deck.
 */
export function PageHead({
  sheet,
  scale,
  h1,
  deck,
  children,
}: {
  sheet: SheetId
  scale: string
  h1: string
  deck?: Rich
  children?: ReactNode
}) {
  const page = site.nav.find((it) => it.sheet === sheet)
  return (
    <header className={`${s.pageHead} wrap`} data-sheet={sheet}>
      <div className={s.columns} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <GridBubbles />
      <p className={s.strip}>
        {site.sheet.label} {sheet}
        {page ? <> · {page.sheetTitle}</> : null} · {scale}
      </p>
      <h1 id={`sheet-${sheet.toLowerCase()}-title`}>{h1}</h1>
      {deck ? <RichText value={deck} className={`lead ${s.deck}`} /> : null}
      {children}
    </header>
  )
}
