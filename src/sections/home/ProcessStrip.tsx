import Link from 'next/link'
import { home } from '@/content/pages/home'
import { processSteps } from '@/content/process'
import { resolveHeld } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { DimensionChain } from '@/components/blueprint/DimensionChain'

/** Home section D: weeks, not quarters (W0 stub; owner: home-about). */
export function ProcessStrip() {
  const c = home.process
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <DimensionChain
        steps={processSteps.map((p) => {
          const len = resolveHeld(p.howLong)
          return {
            label: `${p.id} ${p.name}`,
            length: len.show === 'text' ? len.text : len.show === 'hold' ? len.hold.note : '',
            you: `${c.youPrefix} ${p.youShort}`,
          }
        })}
      />
      <p>
        <Link href={c.link.href as '/how-it-works'}>{c.link.label}</Link>
      </p>
    </section>
  )
}
