import type { ProcessId, ServiceId } from '@/content/types'
import s from './blueprint.module.css'

/** A sheet tab: a big stencil numeral (decorative, aria-hidden) plus the real id as text. */
export function SheetTab({ id }: { id: ServiceId | ProcessId }) {
  return (
    <span className={s.sheetTab} data-tab={id}>
      <span className={s.numeral} aria-hidden="true">
        {id.slice(-2)}
      </span>
      <span className={s.tabText}>{id}</span>
    </span>
  )
}
