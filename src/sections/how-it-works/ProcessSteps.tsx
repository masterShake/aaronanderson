import { howItWorks } from '@/content/pages/how-it-works'
import { processSteps } from '@/content/process'
import { RichText } from '@/components/ui/RichText'
import { HeldText } from '@/components/ui/HeldText'
import { SpecGrid } from '@/components/blueprint/SpecGrid'
import { Stamp } from '@/components/blueprint/Stamp'
import { RevisionTable } from '@/components/blueprint/RevisionTable'

/** Steps P-01 to P-05 (W0 stub; owner: how). */
export function ProcessSteps() {
  const sp = howItWorks.spec
  return (
    <>
      {processSteps.map((p) => {
        const id = p.id.toLowerCase()
        return (
          <section key={p.id} id={id} aria-labelledby={`${id}-title`} className="wrap">
            <h2 id={`${id}-title`} data-rev-value={p.id}>
              {p.id} · {p.name}: {p.title}
            </h2>
            <Stamp text={p.stamp} />
            <SpecGrid
              cells={[
                { label: sp.weDo, value: <RichText value={p.weDo} as="span" /> },
                { label: sp.youDo, value: <RichText value={p.youDo} as="span" /> },
                { label: sp.howLong, value: <HeldText value={p.howLong} /> },
                { label: sp.youGet, value: <RichText value={p.youGet} as="span" /> },
              ]}
            />
          </section>
        )
      })}
      <div className="wrap">
        <RevisionTable
          caption={howItWorks.revTable.caption}
          columns={howItWorks.revTable.columns}
          rows={processSteps.map((p, i) => [String(i), p.name, p.rev.change, p.rev.approvedBy])}
        />
      </div>
    </>
  )
}
