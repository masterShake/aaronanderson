import { contact } from '@/content/pages/contact'
import { site } from '@/content/site'
import { PageHead } from '@/components/blueprint/PageHead'
import { noScheduler } from './scheduler'

export function ContactHead() {
  return (
    <PageHead
      sheet="G-03"
      scale={site.sheet.scale}
      h1={noScheduler ? contact.h1NoScheduler : contact.h1}
      deck={contact.deck}
    />
  )
}
