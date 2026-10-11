import { howItWorks } from '@/content/pages/how-it-works'
import { glossary, legendSymbols } from '@/content/legend'
import { SHOW_HOLDS } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { LegendTable } from '@/components/blueprint/LegendTable'

/**
 * The legend (id "legend", Home B's Legend link): every symbol in plain words,
 * then the AI glossary that the Term toggletips across the site point to
 * (#term-{id}). Production shows no HOLDs, so it drops the HOLD symbol too.
 */
export function LegendSection() {
  const c = howItWorks.legend
  const symbols = SHOW_HOLDS ? legendSymbols : legendSymbols.filter((x) => x.id !== 'hold')
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <LegendTable
        symbols={symbols}
        glossary={glossary}
        columns={c.columns}
        captions={{ symbols: c.symbolsCaption, glossary: c.glossaryCaption }}
      />
    </section>
  )
}
