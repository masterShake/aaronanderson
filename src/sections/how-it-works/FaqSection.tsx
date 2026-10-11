import { howItWorks } from '@/content/pages/how-it-works'
import { faq } from '@/content/faq'
import { isHold, resolveHeld } from '@/content/hold'
import { RichText } from '@/components/ui/RichText'
import { HoldChip } from '@/components/blueprint/HoldChip'
import { SectionHead } from '@/components/blueprint/SectionHead'

/** Questions people ask before they book, as an RFI log (W0 stub; owner: how). */
export function FaqSection() {
  const c = howItWorks.faq
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      {faq.map((f) => {
        if (isHold(f.a)) {
          const r = resolveHeld(f.a)
          if (r.show === 'omit') return null
          return (
            <details key={f.id}>
              <summary>{f.q}</summary>
              {r.show === 'hold' ? <HoldChip hold={r.hold} /> : <p>{r.text}</p>}
            </details>
          )
        }
        return (
          <details key={f.id}>
            <summary>{f.q}</summary>
            <RichText value={f.a} />
          </details>
        )
      })}
    </section>
  )
}
