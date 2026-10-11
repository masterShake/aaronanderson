import type { ReactNode } from 'react'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/** Marks a promise still waiting for the owner's CONFIRM. Preview only (Claimed and RichText decide). */
export function ConfirmMark({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className={s.confirm} data-confirm={id}>
      {children}
      <span className={s.confirmMark}>
        <span className="sr-only">{site.marks.confirmLabel}</span>
        {site.marks.confirm}
      </span>
    </span>
  )
}
