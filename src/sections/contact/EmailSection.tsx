import { contact } from '@/content/pages/contact'
import { site } from '@/content/site'
import { fact } from '@/content/hold'
import { CopyEmail } from '@/components/ui/CopyEmail.client'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'

export function EmailSection() {
  const c = contact.email
  const email = fact(site.email)
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
