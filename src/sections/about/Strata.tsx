import { about } from '@/content/pages/about'
import { resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { StrataFigure } from '@/figures/strata/StrataFigure'
import s from './about.module.css'

/**
 * About: "Field, office and code: where we come from." The static strata
 * figure and, from 1024 px, one note per band beside it. A band whose note has
 * nothing to show in production is left out; with no notes at all the heading
 * and its line take the column beside the figure instead, so the section has
 * no empty half.
 */
export function Strata() {
  const c = about.strata
  const layers = c.layers.filter((l) => resolveHeld(l.text).show !== 'omit')
  const head = <SectionHead id={c.id} h2={c.h2} body={c.body} />
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      {layers.length ? head : null}
      <div className={`${s.split} ${layers.length ? '' : s.headBeside}`}>
        {layers.length ? null : <div className={s.head}>{head}</div>}
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
