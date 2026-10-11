import { home } from '@/content/pages/home'
import { RichText } from '@/components/ui/RichText'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { GridBubbles } from '@/components/blueprint/GridBubbles'
import { HeroFigure } from '@/figures/hero/HeroFigure'
import Link from 'next/link'
import s from './home.module.css'

/** Home section A: the words and the hero figure (W0 stub; owner: hero). */
export function HomeHero() {
  const h = home.hero
  return (
    <section id="hero" aria-labelledby="hero-title" className={`${s.hero} wrap`}>
      <GridBubbles />
      <div className={s.heroText}>
        <p className={s.eyebrow}>
          <span className={s.full}>{h.eyebrow.full}</span>
          <span className={s.short}>{h.eyebrow.short}</span>
        </p>
        <h1 id="hero-title">{h.h1}</h1>
        <p className={s.signoff}>{h.signoff}</p>
        <RichText value={h.deck} className="lead" />
        <p className={s.actions}>
          <BookCallButton size="lg" />
          <Link href={h.seeDrawing.href} className={s.see}>
            {h.seeDrawing.label}
          </Link>
        </p>
        <p className={s.spec}>{h.specLine}</p>
      </div>
      <div className={s.heroFigure}>
        <HeroFigure />
      </div>
    </section>
  )
}
