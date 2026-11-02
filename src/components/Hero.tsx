import { CONTACT, HERO } from '@/content/copy'
import { CHAPTERS } from '@/lib/story/chapters'
import styles from './Hero.module.css'

/** What gets built in each chapter, listed like the sheet index on a drawing set. */
const SHEETS = ['Floor plan', 'Foundation & framing', 'Roof, electrical, plumbing', 'Kitchen', 'Finished house']

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <p className="eyebrow">{HERO.eyebrow}</p>
        <h1 id="hero-title">{HERO.title}</h1>
        <p className="lead">{HERO.lead}</p>
        <div className={styles.actions}>
          <a className="pill" href={CONTACT.href}>
            {HERO.cta}
          </a>
          <a className="link-arrow" href={`#${CHAPTERS[0].id}`}>
            {HERO.scroll} ↓
          </a>
        </div>
      </div>
      <nav className={styles.index} aria-label="Sheet index">
        <p className="micro">Sheet index</p>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <a href={`#${c.id}`}>
                <span className={styles.num}>{c.n}</span>
                <span className={styles.sheet}>{SHEETS[i]}</span>
                <span className={styles.audience}>{c.audience}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  )
}
