import { about } from '@/content/pages/about'
import { site } from '@/content/site'
import { PageHead } from '@/components/blueprint/PageHead'

export function AboutHead() {
  return <PageHead sheet="G-02" scale={site.sheet.scale} h1={about.h1} deck={about.deck} />
}
