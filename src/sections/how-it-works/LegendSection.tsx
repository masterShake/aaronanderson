import { howItWorks } from '@/content/pages/how-it-works'
import { glossary, legendSymbols } from '@/content/legend'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { LegendTable } from '@/components/blueprint/LegendTable'

export function LegendSection() {
  const c = howItWorks.legend
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <LegendTable
        symbols={legendSymbols}
        glossary={glossary}
        columns={c.columns}
        captions={{ symbols: c.symbolsCaption, glossary: c.glossaryCaption }}
      />
    </section>
  )
}
