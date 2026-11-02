import { ABOUT } from '@/content/copy'
import styles from './About.module.css'

export function About() {
  return (
    <section id="about" className={styles.about} aria-labelledby="about-title">
      <p className={`eyebrow ${styles.eyebrow}`}>{ABOUT.eyebrow}</p>
      <h2 id="about-title" className={styles.title}>
        {ABOUT.title}
      </h2>
      <p className={`lead ${styles.body}`}>{ABOUT.body}</p>
      <ul className={styles.facts}>
        {ABOUT.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  )
}
