import { CONTACT, NAV_CTA, SITE } from '@/content/copy'
import { CHAPTERS } from '@/lib/story/chapters'
import styles from './SiteHeader.module.css'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a className={styles.wordmark} href="#main">
        {SITE.name}
      </a>
      <nav className={styles.nav} aria-label="Chapters">
        <ul>
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} data-nav={c.id}>
                {c.nav}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <a className="pill pill-sm" href={CONTACT.href}>
        {NAV_CTA}
      </a>
    </header>
  )
}
