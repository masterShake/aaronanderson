import type { ProcessId, ServiceId } from '@/content/types'
import s from './blueprint.module.css'

/** A sheet tab: a stencil numeral (decorative) plus the real text. */
export function SheetTab({ id }: { id: ServiceId | ProcessId }) {
  return (
    <span className={s.sheetTab}>
      <span className={s.numeral} aria-hidden="true">
        {id.slice(-2)}
      </span>
      <span className={s.strip}>{id}</span>
    </span>
  )
}
