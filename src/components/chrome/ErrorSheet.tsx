import type { ReactNode } from 'react'
import type { ErrorContent, NavItem } from '@/content/types'
import u from '@/components/ui/ui.module.css'
import s from './chrome.module.css'

/**
 * The sheet-styled body shared by app/error.tsx and app/global-error.tsx: a
 * mono strip, the H1, a line of copy, Try again, Book a call and links to all
 * five sheets. Copy comes in as props, so it renders inside a client error
 * boundary. Book a call is a plain link (a full load), since the router may be
 * what broke; `link` renders each sheet link (next/link, or a plain <a> when
 * the root layout itself failed).
 */
export function ErrorSheet({
  copy,
  strip,
  nav,
  book,
  onRetry,
  link,
}: {
  copy: ErrorContent
  strip: string
  nav: readonly NavItem[]
  book: { label: string; href: string }
  onRetry: () => void
  link: (it: NavItem) => ReactNode
}) {
  return (
    <div className={`${s.errorSheet} wrap`}>
      <p className={s.errorStrip}>{strip}</p>
      <h1 id="error-title">{copy.h1}</h1>
      <p className="lead">{copy.body}</p>
      <div className={s.errorActions}>
        <button type="button" className={`${u.button} ${u.secondary}`} onClick={onRetry}>
          {copy.retry}
        </button>
        <a href={book.href} className={`${u.button} ${u.book}`} data-variant="book">
          {book.label}
        </a>
      </div>
      <nav aria-labelledby="error-links" className={s.errorNav}>
        <h2 id="error-links" className={s.errorLinksTitle}>
          {copy.links}
        </h2>
        <ul>
          {nav.map((it) => (
            <li key={it.page}>{link(it)}</li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
