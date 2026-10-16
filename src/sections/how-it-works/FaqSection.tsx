import type { ReactNode } from 'react'
import { howItWorks } from '@/content/pages/how-it-works'
import { faq } from '@/content/faq'
import { isConfirm, isHold, resolveClaim, resolveHeld } from '@/content/hold'
import type { Confirm, Rich } from '@/content/types'
import { RichText } from '@/components/ui/RichText'
import { HoldChip } from '@/components/blueprint/HoldChip'
import { SectionHead } from '@/components/blueprint/SectionHead'
import s from './how.module.css'

/**
 * Questions people ask before they book, as an RFI log: native <details>, so
 * every item opens and closes with the keyboard and without JS. Each summary
 * is numbered RFI-01, RFI-02 … by a CSS counter. Answers only the owner can
 * give are HOLDs; answers that promise something are CONFIRMs (both preview only).
 */
export function FaqSection() {
  const c = howItWorks.faq
  const items = faq.flatMap((f) => {
    let answer: ReactNode
    let open = false
    if (isHold(f.a)) {
      const r = resolveHeld(f.a)
      if (r.show === 'omit') return []
      answer = r.show === 'hold' ? <HoldChip hold={r.hold} /> : <p>{r.text}</p>
      open = r.show === 'hold'
    } else if (isConfirm(f.a)) {
      if (resolveClaim(f.a as Confirm<Rich>).show === 'omit') return []
      answer = <RichText value={f.a as Confirm<Rich>} />
    } else answer = <RichText value={f.a} />
    return [{ id: f.id, q: f.q, answer, open }]
  })
  if (!items.length) return null
  // A short log (the production look while most answers wait for the owner) starts open,
  // so the section reads as answered rather than as one closed row.
  const expand = items.length < 3
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.faq}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <p className={s.logLabel} aria-hidden="true">
        {c.logLabel}
      </p>
      <div className={s.rfiLog}>
        {items.map((f) => (
          <details key={f.id} id={`rfi-${f.id}`} className={s.rfi} open={expand || undefined}>
            <summary className={s.rfiQ}>
              <span className={s.rfiText}>{f.q}</span>
              <span className={s.rfiStatus} aria-hidden="true">
                {f.open ? c.open : c.closed}
              </span>
            </summary>
            <div className={s.rfiA}>{f.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
