import { contact } from '@/content/pages/contact'
import { site } from '@/content/site'
import { SHOW_HOLDS, fact } from '@/content/hold'
import { CopyEmail } from '@/components/ui/CopyEmail.client'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'

/** #email. While the address is a HOLD, production leaves the section out (as BookSection does). */
export function EmailSection() {
  const c = contact.email
  const email = fact(site.email)
  if (!email && !SHOW_HOLDS) return null
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <p>
        {email ? (
          <CopyEmail
            email={email}
            copy={c.copy}
            copied={c.copied}
            live={c.copiedLive}
            failed={c.copyFailed}
          />
        ) : (
          <HeldText value={site.email} />
        )}
      </p>
    </section>
  )
}
