import { FOOTER } from '@/content/copy'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className="small">{FOOTER.line}</p>
      <p className="small">{FOOTER.domain}</p>
    </footer>
  )
}
