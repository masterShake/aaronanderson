import { howItWorks } from '@/content/pages/how-it-works'
import { Claimed } from '@/components/ui/Claimed'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { ValveFigure } from '@/figures/valve/ValveFigure'

/** Where the machine stops and a person signs (W0 stub; owner: how). */
export function ControlSection() {
  const c = howItWorks.control
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ValveFigure />
      <ul>
        {c.plates.map((pl) => (
          <Claimed key={pl.id} value={pl.text}>
            {(text) => (
              <li>
                <strong>{pl.title}</strong> {text}
              </li>
            )}
          </Claimed>
        ))}
      </ul>
    </section>
  )
}
