import type { ReactNode } from 'react'
import type { Rich, SheetId } from '@/content/types'
import { site } from '@/content/site'
import { RichText } from '@/components/ui/RichText'
import { GridBubbles } from './GridBubbles'
import s from './blueprint.module.css'

/** The sheet head: mono strip, the page's only H1, and the deck. */
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
  return (
    <header className={`${s.pageHead} wrap`} data-sheet={sheet}>
      <GridBubbles />
      <p className={s.strip}>
        {site.sheet.label} {sheet} · {scale}
      </p>
      <h1>{h1}</h1>
      {deck ? <RichText value={deck} className="lead" /> : null}
      {children}
    </header>
  )
}
