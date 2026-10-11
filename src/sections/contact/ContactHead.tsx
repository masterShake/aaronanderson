import { contact } from '@/content/pages/contact'
import { site } from '@/content/site'
import { PageHead } from '@/components/blueprint/PageHead'

export function ContactHead() {
  return <PageHead sheet="G-03" scale={site.sheet.scale} h1={contact.h1} deck={contact.deck} />
}
