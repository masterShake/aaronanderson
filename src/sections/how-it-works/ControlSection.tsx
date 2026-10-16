import { howItWorks } from '@/content/pages/how-it-works'
import { resolveClaim } from '@/content/hold'
import { Claimed } from '@/components/ui/Claimed'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { ValveFigure } from '@/figures/valve/ValveFigure'
import s from './how.module.css'

/**
 * Where the machine stops and a person signs: the sign-off detail (cols 1-8
 * at 1024 px and up) and the five plates (cols 9-12). Each plate is a promise
 * the owner confirms: marked CONFIRM in preview, left out in production until then.
 */
export function ControlSection() {
  const c = howItWorks.control
  // Until a plate is confirmed the production look has none: the detail takes the full width.
  const anyPlate = c.plates.some((pl) => resolveClaim(pl.text).show !== 'omit')
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.control}`}>
      <div className={s.controlHead}>
        <SectionHead id={c.id} h2={c.h2} body={c.body} />
      </div>
      <div className={`${s.valveCol} ${anyPlate ? '' : s.valveSolo}`}>
        <ValveFigure />
      </div>
      {anyPlate ? (
        <ul className={s.plates}>
          {c.plates.map((pl) => (
            <Claimed key={pl.id} value={pl.text}>
              {(text) => (
                <li className={s.plate} data-plate={pl.id}>
                  <strong className={s.plateTitle}>{pl.title}</strong> {text}
                </li>
              )}
            </Claimed>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
