import type { ReactNode } from 'react'
import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import { site } from '@/content/site'
import type { Service, ServiceId } from '@/content/types'
import { resolveClaim } from '@/content/hold'
import { talkHref } from '@/lib/routes'
import { RichText } from '@/components/ui/RichText'
import { SheetTab } from '@/components/blueprint/SheetTab'
import { Callout } from '@/components/blueprint/Callout'
import { SheetLink } from '@/components/chrome/SheetLink.client'
import { S01Figure } from '@/figures/s01/S01Figure'
import { S02Figure } from '@/figures/s02/S02Figure'
import { S03Figure } from '@/figures/s03/S03Figure'
import { S04Figure } from '@/figures/s04/S04Figure'
import { S05Figure } from '@/figures/s05/S05Figure'
import { S06Figure } from '@/figures/s06/S06Figure'
import { LengthChart } from './ScheduleSection'
import { PriceText } from './PriceText'
import { RailSpy } from './RailSpy.client'
import s from './services.module.css'

const FIGURES: Record<ServiceId, () => ReactNode> = {
  'S-01': S01Figure,
  'S-02': S02Figure,
  'S-03': S03Figure,
  'S-04': S04Figure,
  'S-05': S05Figure,
  'S-06': S06Figure,
}

const RAIL_ID = 'sheet-rail'

/**
 * Sheets S-01 to S-06, with the sticky sheet rail (1280 px and up) beside them.
 *
 * Scrub layout (the contract every service figure relies on): from 1024 px a
 * sheet is two columns; the text column carries data-scrub-track and the figure
 * column stretches to the same height, with the <figure> itself sticky at
 * --sticky-top. Below 1024 px the text column dissolves (display: contents) so
 * the figure sits inline after the explanation and plays on entry.
 */
export function ServiceSheets() {
  return (
    <div className={s.sheets}>
      <div className={s.rail}>
        <nav id={RAIL_ID} aria-label={servicesPage.rail.label} className={s.railNav}>
          <ol className={s.railList}>
            {services.map((sv) => (
              <li key={sv.id}>
                <a href={`#${sv.slug}`} className={s.railLink}>
                  <span>{sv.name}</span>
                  <span className={s.railId}>{sv.id}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <RailSpy rail={RAIL_ID} />
      </div>
      {services.map((sv) => (
        <ServiceSheet key={sv.id} service={sv} />
      ))}
    </div>
  )
}

function ServiceSheet({ service: sv }: { service: Service }) {
  const l = servicesPage.sheet
  const Figure = FIGURES[sv.id]
  const talk = talkHref(sv.id)
  return (
    <section
      id={sv.slug}
      aria-labelledby={`${sv.slug}-title`}
      className={`wrap ${s.sheet}`}
      data-service={sv.id}
    >
      <div className={s.text} data-scrub-track="">
        <div className={s.lede}>
          <SheetTab id={sv.id} />
          <h2 id={`${sv.slug}-title`} className={s.h2}>
            {sv.id} · {sv.name}
          </h2>
          <p className={`lead ${s.promise}`}>{sv.promise}</p>
          <p className={s.explain}>
            {sv.explanation[0]} {sv.explanation[1]}
          </p>
          {sv.plainTerms && resolveClaim(sv.plainTerms).show !== 'omit' ? (
            <Callout variant="note">
              <p className={s.plain}>
                <strong>{l.plainTerms}</strong> <RichText value={sv.plainTerms} as="span" />
              </p>
            </Callout>
          ) : null}
        </div>
        <div className={s.body}>
          <h3 className={s.h3}>{l.examples}</h3>
          <ul className={s.examples}>
            {sv.examples.map((e, i) => (
              <RichText key={i} value={e} as="li" />
            ))}
          </ul>
          <h3 className={s.h3}>{l.receive}</h3>
          <ol className={s.receive}>
            {sv.receive.map((r, i) => (
              <li key={i}>
                <span className={s.receiveItem}>{r.item}</span>
                {r.note ? (
                  <RichText
                    value={{
                      text: r.note,
                      vars: sv.shape.improvementHours ? { hours: sv.shape.improvementHours } : {},
                    }}
                    as="span"
                    className={s.receiveNote}
                  />
                ) : null}
              </li>
            ))}
          </ol>
          <h3 className={s.h3}>{l.shape}</h3>
          <div className={s.shape}>
            <LengthChart service={sv} />
            {sv.shape.price ? (
              <p className={s.priceChip}>
                <PriceText price={sv.shape.price} />
              </p>
            ) : null}
            <RichText value={sv.shape.summary} className={s.summary} />
          </div>
          <p className={s.talk}>
            <SheetLink href={talk} className={s.talkLink} data-print-url={site.url + talk}>
              <RichText value={l.talk} vars={{ sheet: sv.id }} as="span" />
            </SheetLink>
          </p>
        </div>
      </div>
      <div className={s.figCol}>
        <Figure />
      </div>
    </section>
  )
}
