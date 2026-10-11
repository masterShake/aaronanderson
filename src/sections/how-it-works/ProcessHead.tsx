import { howItWorks } from '@/content/pages/how-it-works'
import { site } from '@/content/site'
import { PageHead } from '@/components/blueprint/PageHead'

export function ProcessHead() {
  return (
    <PageHead sheet="P-00" scale={site.sheet.scale} h1={howItWorks.h1} deck={howItWorks.deck} />
  )
}
