import type { ReactNode } from 'react'
import { SHOW_HOLDS } from '@/content/hold'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/**
 * Marks a promise still waiting for the owner's CONFIRM: a dotted blueprint
 * outline and a CONFIRM tag. Preview only; Claimed and RichText leave pending
 * claims out of production, and this renders the bare text if one slips through.
 */
export function ConfirmMark({ id, children }: { id: string; children: ReactNode }) {
  if (!SHOW_HOLDS) return <>{children}</>
  return (
    <span className={s.confirm} data-confirm={id}>
      <span className="sr-only">{site.marks.confirmLabel}</span>
      {children}
      <span className={s.confirmMark} aria-hidden="true">
        {site.marks.confirm}
      </span>
    </span>
  )
}
