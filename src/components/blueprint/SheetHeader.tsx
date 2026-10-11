import type { SheetId } from '@/content/types'
import s from './blueprint.module.css'

/**
 * A sheet header strip drawn as a row of title-block cells: number, title,
 * scale, revision and issue date. Not a heading (headings carry structure).
 */
export function SheetHeader({
  sheet,
  title,
  scale,
  rev,
  issued,
}: {
  sheet: SheetId
  title: string
  scale?: string
  rev?: string
  issued?: string
}) {
  const cells = [sheet, title, scale, rev, issued].filter((c): c is string => Boolean(c))
  return (
    <ul className={s.sheetHeader} data-sheet={sheet}>
      {cells.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ul>
  )
}
