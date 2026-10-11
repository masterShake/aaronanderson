import { home } from '@/content/pages/home'
import { RichText } from '@/components/ui/RichText'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { GridBubbles } from '@/components/blueprint/GridBubbles'
import { HeroFigure } from '@/figures/hero/HeroFigure'
import Link from 'next/link'
import s from './hero/hero.module.css'

/**
 * Home section A (D2 A): the page's only H1, the sign-off line as real text directly under
 * it, the deck, Book a call plus "See the drawing ↓" (hidden at 1024 px and up), the mono
 * line, and DETAIL 1. The words paint first and stay the LCP; the figure never pushes them.
 */
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
        <h1 id="hero-title" className={s.h1}>
          {h.h1}
          <span aria-hidden="true">*</span>
        </h1>
        <p className={s.signoff}>{h.signoff}</p>
        <RichText value={h.deck} className={`lead ${s.deck}`} />
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
