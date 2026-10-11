import { about } from '@/content/pages/about'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { StrataFigure } from '@/figures/strata/StrataFigure'

export function Strata() {
  const c = about.strata
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <StrataFigure />
      <dl>
        {c.layers.map((l) => (
          <div key={l.id}>
            <dt>{l.label}</dt>
            <dd>
              <HeldText value={l.text} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
