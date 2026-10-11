import type { ReactNode } from 'react'
import type { GlossaryTerm, LegendSymbol, LegendSymbolId } from '@/content/types'
import { RichText } from '@/components/ui/RichText'
import s from './blueprint.module.css'

/** Small drawn glyphs for the legend (decorative; the term and plain words carry the meaning). */
const GLYPHS: Readonly<Record<LegendSymbolId, ReactNode>> = {
  tool: <rect x="8" y="5" width="32" height="18" fill="none" stroke="currentColor" />,
  conduit: <path d="M2 14h44" stroke="currentColor" strokeWidth="3" />,
  'hand-carry': (
    <path
      d="M2 14c8-6 14 6 22 0s14 6 22 0"
      fill="none"
      stroke="currentColor"
      strokeDasharray="4 3"
    />
  ),
  packet: (
    <>
      <path d="M2 14h44" stroke="currentColor" />
      <rect className={s.pkt} x="19" y="9" width="10" height="10" />
    </>
  ),
  'ai-step': (
    <>
      <ellipse cx="24" cy="14" rx="18" ry="10" fill="none" stroke="currentColor" />
      <path d="M17 14h14M24 8v12" stroke="currentColor" strokeWidth="0.75" />
    </>
  ),
  'sign-off': (
    <>
      <path d="M2 14h12M34 14h12" stroke="currentColor" strokeWidth="2" />
      <path d="M14 6v16l20-16v16Z" fill="none" stroke="currentColor" />
    </>
  ),
  tolerance: (
    <>
      <path d="M8 22a16 16 0 0 1 32 0" fill="none" stroke="currentColor" />
      <path d="M24 22 31 10" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  'data-store': (
    <>
      <ellipse cx="24" cy="7" rx="12" ry="4" fill="none" stroke="currentColor" />
      <path d="M12 7v14c0 2.2 5.4 4 12 4s12-1.8 12-4V7" fill="none" stroke="currentColor" />
    </>
  ),
  monitor: (
    <>
      <circle cx="24" cy="14" r="10" fill="none" stroke="currentColor" />
      <path d="M24 14 30 8M17 18h14" stroke="currentColor" />
    </>
  ),
  logbook: (
    <>
      <rect x="13" y="4" width="22" height="20" fill="none" stroke="currentColor" />
      <path d="M17 10h14M17 14h14M17 18h9" stroke="currentColor" strokeWidth="0.75" />
    </>
  ),
  'revision-cloud': (
    <path
      className={s.rl}
      d="M10 18a4 4 0 0 1 2-7 5 5 0 0 1 8-4 5 5 0 0 1 9 0 5 5 0 0 1 8 4 4 4 0 0 1 1 8 4 4 0 0 1-6 3 5 5 0 0 1-8 0 5 5 0 0 1-8 0 4 4 0 0 1-6-4Z"
      fill="none"
      strokeWidth="1.5"
    />
  ),
  hold: (
    <>
      <rect
        x="6"
        y="5"
        width="36"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 2"
      />
      <rect x="6" y="5" width="12" height="6" fill="currentColor" />
    </>
  ),
}

/**
 * The legend: a symbols table (glyph, term, plain words) and then the AI
 * glossary as a definition list. Each glossary entry has id `term-{id}`, the
 * target the Term toggletips point readers to.
 */
export function LegendTable({
  symbols,
  glossary,
  columns,
  captions,
  compact,
}: {
  symbols: readonly LegendSymbol[]
  glossary: readonly GlossaryTerm[]
  columns: readonly [string, string, string]
  captions?: { symbols: string; glossary: string }
  compact?: boolean
}) {
  return (
    <div data-compact={compact ? '' : undefined}>
      <div className="scroll">
        <table className={s.table} data-legend="">
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
              <tr key={sym.id} id={`symbol-${sym.id}`}>
                <td data-symbol={sym.id}>
                  <svg className={s.glyph} viewBox="0 0 48 28" aria-hidden="true" focusable="false">
                    <g strokeWidth="1.5">{GLYPHS[sym.id]}</g>
                  </svg>
                </td>
                <th scope="row">{sym.term}</th>
                <td>{sym.plain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {captions ? <p className={s.notesTitle}>{captions.glossary}</p> : null}
      <dl className={s.glossary}>
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
