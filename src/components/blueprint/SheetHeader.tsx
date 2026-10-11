import type { SheetId } from '@/content/types'
import s from './blueprint.module.css'

/** A sheet header strip: number, title, scale, revision and issue date. */
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
  return <p className={s.strip}>{[sheet, title, scale, rev, issued].filter(Boolean).join(' · ')}</p>
}
