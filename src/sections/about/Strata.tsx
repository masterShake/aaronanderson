import { about } from '@/content/pages/about'
import { resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { StrataFigure } from '@/figures/strata/StrataFigure'
import s from './about.module.css'

/**
 * About: "Field, office and code: where we come from." The static strata
 * figure, and beside it (from 1024 px) one note per band; a band whose note
 * has nothing to show in production is left out.
 */
export function Strata() {
  const c = about.strata
  const layers = c.layers.filter((l) => resolveHeld(l.text).show !== 'omit')
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <div className={s.split}>
        <div className={s.figure}>
          <StrataFigure />
        </div>
        {layers.length ? (
          <dl className={s.layers}>
            {layers.map((l) => (
              <div key={l.id}>
                <dt>{l.label}</dt>
                <dd>
                  <HeldText value={l.text} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  )
}
