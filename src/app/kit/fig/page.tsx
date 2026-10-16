import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { preview } from '@/content/pages/preview'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import {
  PEOPLE_IDS,
  SYMBOL_IDS,
  TOOL_TILE_KINDS,
  isoTile,
  symbolTile,
  toolTile,
  type Tile,
} from './showcase.server'
import s from './showcase.module.css'

/**
 * Preview only: the drawing kit on one sheet. Every scale figure and symbol in
 * pencil (paper) and CAD (blueprint), and a small iso print. Each tile is
 * captioned with its library id (data, not copy). Production returns 404.
 */

export const metadata: Metadata = pageMetadata('kit')

function Tiles({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <ul className={s.grid}>
      {tiles.map((t) => (
        <li key={`${t.id}-${t.medium}`} className={s.tile} data-medium={t.medium}>
          <div
            className={s.art}
            aria-hidden="true"
            data-showcase={t.id}
            dangerouslySetInnerHTML={{ __html: t.svg }}
          />
          <code className={s.id}>{t.id}</code>
        </li>
      ))}
    </ul>
  )
}

export default function KitFigShowcase() {
  if (!PREVIEW_PAGES) notFound()
  const people = PEOPLE_IDS.flatMap((id) => [symbolTile(id, 'pencil'), symbolTile(id, 'cad')])
  const symbols = SYMBOL_IDS.flatMap((id) => [symbolTile(id, 'pencil'), symbolTile(id, 'cad')])
  const tools = TOOL_TILE_KINDS.flatMap((k) => [toolTile(k, 'pencil'), toolTile(k, 'cad')])
  return (
    <section className={s.sheet} aria-labelledby="kit-fig-h1">
      <h1 id="kit-fig-h1" className="sr-only">
        {preview.kit.h1}
      </h1>
      <div data-showcase-group="people">
        <Tiles tiles={people} />
      </div>
      <div data-showcase-group="tools">
        <Tiles tiles={tools} />
      </div>
      <div data-showcase-group="symbols">
        <Tiles tiles={symbols} />
      </div>
      <div data-showcase-group="iso">
        <Tiles tiles={[isoTile()]} />
      </div>
    </section>
  )
}
