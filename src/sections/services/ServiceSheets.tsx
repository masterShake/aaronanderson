import Link from 'next/link'
import type { ReactNode } from 'react'
import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import type { ServiceId } from '@/content/types'
import { talkHref } from '@/lib/routes'
import { RichText } from '@/components/ui/RichText'
import { HeldText } from '@/components/ui/HeldText'
import { SheetTab } from '@/components/blueprint/SheetTab'
import { Callout } from '@/components/blueprint/Callout'
import { Schedule } from '@/components/blueprint/Schedule'
import { S01Figure } from '@/figures/s01/S01Figure'
import { S02Figure } from '@/figures/s02/S02Figure'
import { S03Figure } from '@/figures/s03/S03Figure'
import { S04Figure } from '@/figures/s04/S04Figure'
import { S05Figure } from '@/figures/s05/S05Figure'
import { S06Figure } from '@/figures/s06/S06Figure'

const FIGURES: Record<ServiceId, () => ReactNode> = {
  'S-01': S01Figure,
  'S-02': S02Figure,
  'S-03': S03Figure,
  'S-04': S04Figure,
  'S-05': S05Figure,
  'S-06': S06Figure,
}

/** Sheets S-01 to S-06 (W0 stub; owner: services). */
export function ServiceSheets() {
  const l = servicesPage.sheet
  return (
    <>
      {services.map((s) => {
        const Figure = FIGURES[s.id]
        return (
          <section key={s.id} id={s.slug} aria-labelledby={`${s.slug}-title`} className="wrap">
            <SheetTab id={s.id} />
            <h2 id={`${s.slug}-title`}>
              {s.id} · {s.name}
            </h2>
            <p className="lead">{s.promise}</p>
            <p>
              {s.explanation[0]} {s.explanation[1]}
            </p>
            <Figure />
            <h3>{l.examples}</h3>
            <ul>
              {s.examples.map((e, i) => (
                <RichText key={i} value={e} as="li" />
              ))}
            </ul>
            <h3>{l.receive}</h3>
            <Schedule
              caption={l.receive}
              columns={[
                { key: 'item', label: l.receiveColumns[0] },
                { key: 'note', label: l.receiveColumns[1] },
              ]}
              rows={s.receive.map((r) => ({
                item: <RichText value={r.item} as="span" />,
                note: r.note ? (
                  <RichText
                    value={{
                      text: r.note,
                      vars: s.shape.improvementHours ? { hours: s.shape.improvementHours } : {},
                    }}
                    as="span"
                  />
                ) : null,
              }))}
            />
            <h3>{l.shape}</h3>
            <RichText value={s.shape.summary} />
            {s.shape.price ? (
              <p>
                {s.shape.price.label} <HeldText value={s.shape.price.value} />
              </p>
            ) : null}
            {s.plainTerms ? (
              <Callout variant="note">
                <strong>{l.plainTerms}</strong>
                <RichText value={s.plainTerms} />
              </Callout>
            ) : null}
            <p>
              <Link href={talkHref(s.id)}>
                <RichText value={l.talk} vars={{ sheet: s.id }} as="span" />
              </Link>
            </p>
          </section>
        )
      })}
    </>
  )
}
