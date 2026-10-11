import Link from 'next/link'
import type { Route } from 'next'
import { home } from '@/content/pages/home'
import { processSteps } from '@/content/process'
import { resolveHeld } from '@/content/hold'
import { site } from '@/content/site'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { DimensionChain } from '@/components/blueprint/DimensionChain'
import s from './process.module.css'

/**
 * Home section D: "Weeks, not quarters." The five steps as a dimension chain,
 * each with its length in words and one "You:" line. DimensionChain takes
 * plain strings, so a length still on HOLD reads "HOLD · {note}" in preview;
 * production shows the fallback, or nothing.
 */
export function ProcessStrip() {
  const c = home.process
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.process}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <DimensionChain
        steps={processSteps.map((p) => {
          const len = resolveHeld(p.howLong)
          return {
            label: `${p.id} ${p.name}`,
            length:
              len.show === 'text'
                ? len.text
                : len.show === 'hold'
                  ? `${site.marks.hold} · ${len.hold.note}`
                  : '',
            you: `${c.youPrefix} ${p.youShort}`,
          }
        })}
      />
      <p className={s.link}>
        <Link href={c.link.href as Route}>{c.link.label}</Link>
      </p>
    </section>
  )
}
