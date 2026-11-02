import { CLOSING, CONTACT } from '@/content/copy'
import styles from './Contact.module.css'

export function Contact() {
  return (
    <section id="contact" className={styles.contact} aria-labelledby="contact-title">
      <h2 id="contact-title">{CLOSING.title}</h2>
      <p className="lead">{CLOSING.line}</p>
      <a className="pill" href={CONTACT.href} data-placeholder={CONTACT.placeholder || undefined}>
        {CLOSING.cta}
      </a>
    </section>
  )
}
