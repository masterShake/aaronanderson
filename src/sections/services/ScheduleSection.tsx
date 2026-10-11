import type { CSSProperties } from 'react'
import type { Service } from '@/content/types'
import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { Schedule } from '@/components/blueprint/Schedule'
import { DimensionLine } from '@/components/blueprint/DimensionLine'
import { PriceText } from './PriceText'
import s from './services.module.css'

/** The shared scale of every length chart on the page: 0 to 8 weeks. */
export const WEEKS: readonly [number, number] = [0, 8]

/**
 * The length chart for one service on the shared 0–8 week scale. The label is
 * the text (the drawn line is aria-hidden), so nothing is read twice.
 */
export function LengthChart({ service }: { service: Service }) {
  const c = servicesPage.schedule.chart
  const span = service.shape.span
  if ('sessions' in span)
    return <DimensionLine scale={WEEKS} span={[0, 2]} variant="dots" label={c.sessions} />
  if ('monthly' in span)
    return (
      <DimensionLine
        scale={WEEKS}
        span={[0, 1]}
        extendTo={WEEKS[1]}
        ends="arrows"
        label={c.monthly}
      />
    )
  // Solid from week 0 to the shortest length, dashed on to the longest (S-01: solid 0–2).
  const [lo, hi] = span.weeks
  return <DimensionLine scale={WEEKS} span={[0, lo]} extendTo={hi} label={service.lengthLabel} />
}

/** The week scale on the length column head (0 2 4 6 8), generated from WEEKS. */
const WEEK_TICKS = Array.from({ length: WEEKS[1] / 2 + 1 }, (_, i) => WEEKS[0] + i * 2).join(' ')

/** The schedule, before the details: a real table merged with the 0–8 week chart. */
export function ScheduleSection() {
  const c = servicesPage.schedule
  return (
    <section
      id={c.id}
      aria-labelledby={`${c.id}-title`}
      className={`wrap ${s.schedule}`}
      style={
        {
          '--week-ticks': JSON.stringify(WEEK_TICKS),
          '--week-unit': JSON.stringify(c.chart.unit),
        } as CSSProperties
      }
    >
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <Schedule
        caption={c.caption}
        stack
        columns={[
          { key: 'sheet', label: c.columns.sheet },
          { key: 'service', label: c.columns.service },
          { key: 'length', label: c.columns.length },
          { key: 'pricing', label: c.columns.pricing },
          { key: 'paired', label: c.columns.pairedWith },
        ]}
        rows={services.map((sv) => ({
          sheet: sv.id,
          service: <a href={`#${sv.slug}`}>{sv.name}</a>,
          length: <LengthChart service={sv} />,
          pricing: sv.shape.price ? <PriceText price={sv.shape.price} /> : c.quoted,
          paired: (
            <span className={s.paired}>
              {sv.pairedWith.map((id) => (
                <a key={id} href={`#${id.toLowerCase()}`}>
                  {id}
                </a>
              ))}
            </span>
          ),
        }))}
      />
      <p className={s.chartCaption}>{c.chart.caption}</p>
    </section>
  )
}
