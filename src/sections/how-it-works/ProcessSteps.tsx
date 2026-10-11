import { howItWorks } from '@/content/pages/how-it-works'
import { processSteps } from '@/content/process'
import { RichText } from '@/components/ui/RichText'
import { HeldText } from '@/components/ui/HeldText'
import { SpecGrid } from '@/components/blueprint/SpecGrid'
import { Stamp } from '@/components/blueprint/Stamp'
import { RevisionTable } from '@/components/blueprint/RevisionTable'
import { drawingSrc } from '@/drawings/files'
import { TICKET_REVS } from '@/drawings/graphs/ticket'
import { TicketFigure } from '@/figures/ticket/TicketFigure'
import s from './how.module.css'

/**
 * Steps P-01 to P-05 and the ticket figure. At 1024 px and up the figure is
 * sticky beside the steps, in one grid, and each step section (data-rev-value)
 * sets its revision as it crosses 55% of the viewport. Below 1024 px nothing
 * is sticky: each step carries its own still of the ticket instead.
 */
export function ProcessSteps() {
  const sp = howItWorks.spec
  return (
    <div className={`wrap ${s.process}`}>
      <div className={s.figureCol}>
        <div className={s.sticky}>
          <TicketFigure />
        </div>
      </div>
      <div className={s.steps}>
        {processSteps.map((p, i) => {
          const id = p.id.toLowerCase()
          const rev = TICKET_REVS[i] ?? 'rev0'
          return (
            <section
              key={p.id}
              id={id}
              aria-labelledby={`${id}-title`}
              className={s.step}
              data-rev-value={rev}
            >
              <h2 id={`${id}-title`} className={s.stepTitle}>
                <span className={s.stepId}>{p.id} · </span>
                {p.name}: {p.title}
              </h2>
              <p className={s.stampRow}>
                <Stamp text={p.stamp} />
              </p>
              <SpecGrid
                cells={[
                  { label: sp.weDo, value: <RichText value={p.weDo} as="span" /> },
                  { label: sp.youDo, value: <RichText value={p.youDo} as="span" /> },
                  { label: sp.howLong, value: <HeldText value={p.howLong} /> },
                  { label: sp.youGet, value: <RichText value={p.youGet} as="span" /> },
                ]}
              />
              <figure className={s.still}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={drawingSrc('ticket', `tall.${rev}.still.svg`)}
                  alt=""
                  width={400}
                  height={500}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{p.stillCaption}</figcaption>
              </figure>
            </section>
          )
        })}
        <div className={s.revisions}>
          <RevisionTable
            caption={howItWorks.revTable.caption}
            columns={howItWorks.revTable.columns}
            rows={processSteps.map((p, i) => [String(i), p.name, p.rev.change, p.rev.approvedBy])}
          />
        </div>
      </div>
    </div>
  )
}
