import type { GlossaryTerm, LegendSymbol } from '@/content/types'
import { RichText } from '@/components/ui/RichText'
import s from './blueprint.module.css'

/** The legend: symbols, then the AI glossary, in plain words. */
export function LegendTable({
  symbols,
  glossary,
  columns,
  captions,
}: {
  symbols: readonly LegendSymbol[]
  glossary: readonly GlossaryTerm[]
  columns: readonly [string, string, string]
  captions?: { symbols: string; glossary: string }
  compact?: boolean
}) {
  return (
    <div className="scroll">
      <table className={s.table}>
        {captions ? <caption>{captions.symbols}</caption> : null}
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col">{columns[1]}</th>
            <th scope="col">{columns[2]}</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((sym) => (
            <tr key={sym.id}>
              <td aria-hidden="true" data-symbol={sym.id} />
              <th scope="row">{sym.term}</th>
              <td>{sym.plain}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {captions ? <p className={s.strip}>{captions.glossary}</p> : null}
      <dl>
        {glossary.map((g) => (
          <div key={g.id} id={`term-${g.id}`}>
            <dt>{g.term}</dt>
            <dd>
              <RichText value={g.plain} as="span" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
