import Link from 'next/link'
import { site } from '@/content/site'
import { fact, resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'
import { NorthArrow } from '@/components/blueprint/NorthArrow'
import { Wordmark } from './Wordmark'
import s from './chrome.module.css'

/** The footer as a drawing title block. */
export function Footer() {
  const tb = site.titleBlock
  const phone = fact(site.phone)
  const email = resolveHeld(site.email)
  const year = String(new Date().getFullYear())
  return (
    <footer className={s.footer}>
      <div className="wrap">
        <div className={s.block}>
          <div className={s.cell}>
            <Wordmark size="footer" mark />
            <nav aria-label={tb.sheetIndex}>
              <span className={s.label}>{tb.sheetIndex}</span>
              <ul>
                {site.nav.map((it) => (
                  <li key={it.page}>
                    <Link href={it.href}>
                      {it.sheet} · {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className={s.cell}>
            <p>
              <span className={s.label}>{tb.drawnBy.label}</span>
              <HeldText value={tb.drawnBy.value} />
            </p>
            <p>
              <span className={s.label}>{tb.checkedBy.label}</span>
              <HeldText value={tb.checkedBy.value} />
            </p>
            <p>
              <span className={s.label}>{tb.approvedBy.label}</span>
              {tb.approvedBy.value}
            </p>
          </div>
          <div className={s.cell}>
            {email.show !== 'omit' ? (
              <p>
                <span className={s.label}>{tb.labels.email}</span>
                {email.show === 'text' ? (
                  <a href={`mailto:${email.text}`}>{email.text}</a>
                ) : (
                  <HeldText value={site.email} />
                )}
              </p>
            ) : null}
            {phone ? (
              <p>
                <span className={s.label}>{tb.labels.phone}</span>
                <a href={`tel:${phone}`}>{phone}</a>
              </p>
            ) : null}
            <p>
              <span className={s.label}>{tb.labels.location}</span>
              <HeldText value={site.location} />
            </p>
            <BookCallButton />
            <p>
              <span className={s.label}>{tb.labels.motion}</span>
              <MotionSwitch variant="footer" label={site.motion.label} />
            </p>
          </div>
          <div className={s.cell}>
            <GeneralNotes title={tb.notes.title} items={tb.notes.items} />
            <table>
              <caption className={s.label}>{tb.revisions.label}</caption>
              <thead>
                <tr>
                  {tb.revisions.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.revisions.rows.map((r) => (
                  <tr key={r.rev}>
                    <td>{r.rev}</td>
                    <td>{r.date}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p>
          <NorthArrow label={tb.northArrow} href="#main" variant="top" />
        </p>
        <p className={s.label}>{tb.copyright.replace('{year}', year)}</p>
      </div>
    </footer>
  )
}
