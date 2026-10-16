import { site } from '@/content/site'
import { fact, resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { IntentLink } from '@/components/ui/IntentLink.client'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'
import { NorthArrow } from '@/components/blueprint/NorthArrow'
import { RevisionTable } from '@/components/blueprint/RevisionTable'
import { Wordmark } from './Wordmark'
import s from './chrome.module.css'

/**
 * The footer as a drawing title block (D1): wordmark and sheet index; DRAWN,
 * CHECKED and APPROVED BY: YOU; contact cells (the phone only once it is
 * filled); Book a call and the motion switch; general notes; the REV table;
 * the north arrow back to the top; and the ©.
 */
export function Footer() {
  const tb = site.titleBlock
  const phone = fact(site.phone)
  const email = resolveHeld(site.email)
  const location = resolveHeld(site.location)
  // No empty title-block cell: the contact cell appears once it has something in it.
  const hasContact = Boolean(phone) || email.show !== 'omit' || location.show !== 'omit'
  const year = String(new Date().getFullYear())
  return (
    <footer className={`${s.footer} on-dark`}>
      <div className="wrap">
        <div className={s.block}>
          <div className={`${s.cell} ${s.cellBrand}`}>
            <Wordmark size="footer" mark />
            <nav aria-label={tb.sheetIndex} className={s.index}>
              <p className={s.label}>{tb.sheetIndex}</p>
              <ul>
                {site.nav.map((it) => (
                  <li key={it.page}>
                    <IntentLink href={it.href}>
                      {it.label} <span className={s.indexSheet}>{it.sheet}</span>
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <dl className={`${s.cell} ${s.fields}`}>
            <div>
              <dt className={s.label}>{tb.drawnBy.label}</dt>
              <dd>
                <HeldText value={tb.drawnBy.value} />
              </dd>
            </div>
            <div>
              <dt className={s.label}>{tb.checkedBy.label}</dt>
              <dd>
                <HeldText value={tb.checkedBy.value} />
              </dd>
            </div>
            <div>
              <dt className={s.label}>{tb.approvedBy.label}</dt>
              <dd className={s.approved}>{tb.approvedBy.value}</dd>
            </div>
          </dl>
          {hasContact ? (
            <dl className={`${s.cell} ${s.fields} ${s.contactCell}`}>
              {email.show !== 'omit' ? (
                <div>
                  <dt className={s.label}>{tb.labels.email}</dt>
                  <dd>
                    {email.show === 'text' ? (
                      <a href={`mailto:${email.text}`}>{email.text}</a>
                    ) : (
                      <HeldText value={site.email} />
                    )}
                  </dd>
                </div>
              ) : null}
              {phone ? (
                <div>
                  <dt className={s.label}>{tb.labels.phone}</dt>
                  <dd>
                    <a href={`tel:${phone}`}>{phone}</a>
                  </dd>
                </div>
              ) : null}
              {location.show !== 'omit' ? (
                <div>
                  <dt className={s.label}>{tb.labels.location}</dt>
                  <dd>
                    <HeldText value={site.location} />
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <div className={`${s.cell} ${s.actions}`}>
            <BookCallButton />
            <div>
              <p className={s.label}>{tb.labels.motion}</p>
              <MotionSwitch variant="footer" label={site.motion.label} />
            </div>
          </div>
          <div className={`${s.cell} ${s.wideCell}`}>
            <GeneralNotes title={tb.notes.title} items={tb.notes.items} />
          </div>
          <div className={`${s.cell} ${s.wideCell}`}>
            <RevisionTable
              caption={tb.revisions.label}
              columns={tb.revisions.columns}
              rows={tb.revisions.rows.map((r) => [r.rev, r.date, r.note])}
            />
          </div>
        </div>
        <div className={s.base}>
          <NorthArrow label={tb.northArrow} href="#main" variant="top" />
          <p className={s.label}>{tb.copyright.replace('{year}', year)}</p>
        </div>
      </div>
    </footer>
  )
}
