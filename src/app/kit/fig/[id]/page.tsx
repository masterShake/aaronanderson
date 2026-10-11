import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import type { FigureId } from '@/content/types'
import { preview } from '@/content/pages/preview'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { FirmFigure } from '@/figures/firm/FirmFigure'
import { HeroFigure } from '@/figures/hero/HeroFigure'
import { S01Figure } from '@/figures/s01/S01Figure'
import { S02Figure } from '@/figures/s02/S02Figure'
import { S03Figure } from '@/figures/s03/S03Figure'
import { S04Figure } from '@/figures/s04/S04Figure'
import { S05Figure } from '@/figures/s05/S05Figure'
import { S06Figure } from '@/figures/s06/S06Figure'
import { TicketFigure } from '@/figures/ticket/TicketFigure'
import { ValveFigure } from '@/figures/valve/ValveFigure'
import { OrgChartFigure } from '@/figures/org-chart/OrgChartFigure'
import { StrataFigure } from '@/figures/strata/StrataFigure'
import { AfterContactFigure } from '@/figures/after-contact/AfterContactFigure'
import { NotFoundFigure } from '@/figures/not-found/NotFoundFigure'
import { KitState } from './KitState.client'
import s from './fig.module.css'

/**
 * Preview only: one figure on its own sheet, for building and testing it.
 *   /kit/fig/{FigureId}               the figure as its page renders it
 *   ?tier=still|svg|webgl             tier (read by the head script)
 *   ?state={rev or toggle value}      start in that state (KitState)
 * The firm inlines its layers until the drawings route serves its files.
 * Production builds return 404 for every id.
 */

export const metadata: Metadata = pageMetadata('kit')
export const dynamicParams = false

const FIGURES: Readonly<Record<FigureId, () => ReactNode>> = {
  hero: () => <HeroFigure />,
  firm: () => <FirmFigure />,
  s01: () => <S01Figure />,
  s02: () => <S02Figure />,
  s03: () => <S03Figure />,
  s04: () => <S04Figure />,
  s05: () => <S05Figure />,
  s06: () => <S06Figure />,
  ticket: () => <TicketFigure />,
  valve: () => <ValveFigure />,
  'org-chart': () => <OrgChartFigure />,
  strata: () => <StrataFigure />,
  'after-contact': () => <AfterContactFigure />,
  'not-found': () => <NotFoundFigure />,
}

export function generateStaticParams() {
  return Object.keys(FIGURES).map((id) => ({ id }))
}

export default async function KitFigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const render = FIGURES[id as FigureId]
  if (!PREVIEW_PAGES || !render) notFound()
  return (
    <section className={s.sheet} aria-labelledby="kit-fig-h1">
      <h1 id="kit-fig-h1" className="sr-only">
        {preview.kit.h1}
      </h1>
      {render()}
      <KitState figure={`fig-${id}`} />
    </section>
  )
}
