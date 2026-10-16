import { IntentLink as Link } from '@/components/ui/IntentLink.client'
import type { Route } from 'next'
import { home } from '@/content/pages/home'
import { firmFigure } from '@/content/figures/firm'
import { PATH } from '@/lib/routes'
import { RichText } from '@/components/ui/RichText'
import { FirmFigure } from '@/figures/firm/FirmFigure'
import s from './wiring.module.css'

/**
 * Home section B: "Right now, your people are the wiring." The head sets the
 * point and the kicker side by side (from 1024 px; stacked below), so the
 * kicker lands as the punchline to "a person with two windows open". Then the
 * example-firm schematic (DETAIL 2 / G-01) and, under it, the Legend link with
 * the (E)/(N) margin note once rewired. Nothing here is sticky at any width.
 */
export function Wiring() {
  const c = home.wiring
  const [point, hint] = c.body ?? []
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.wiring}`}>
      <div className={s.head}>
        <h2 id={`${c.id}-title`}>{c.h2}</h2>
        {point ? <RichText value={point} className={s.point} /> : null}
        <p className={s.kicker}>{c.kicker}</p>
        {hint ? <RichText value={hint} className={`${s.hint} ${s.hover}`} /> : null}
        <RichText value={c.bodyTouch} className={`${s.hint} ${s.touch}`} />
      </div>
      <FirmFigure />
      <div className={s.after}>
        <p className={s.legend}>
          <Link href={`${PATH['how-it-works']}#legend` as Route}>
            {firmFigure.controls.legend} →
          </Link>
        </p>
        <p className={`hand ${s.newNote}`}>{c.newNote}</p>
      </div>
    </section>
  )
}
