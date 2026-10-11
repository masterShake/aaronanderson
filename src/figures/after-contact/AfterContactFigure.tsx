import type { CSSProperties } from 'react'
import { afterContactFigure as copy } from '@/content/figures/after-contact'
import { drawingSrc } from '@/drawings/files'
import {
  AFTER_CONTACT_VIEWBOX,
  afterContactLabels,
  type AfterContactLabel,
} from '@/drawings/graphs/after-contact'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { AfterContactController } from './AfterContactController.client'
import s from './after-contact.module.css'

/**
 * DETAIL 1 / G-03: what happens after you reach out. Four nodes joined by
 * conduits, CAD on blueprint-deep; labels are HTML. A time-driven figure
 * with nothing to play beyond the draw-on, so it settles on its still.
 * Named export, no required props: /kit/fig/[id] renders it.
 */
export function AfterContactFigure() {
  const at = afterContactLabels()
  const keys = Object.keys(copy.labels) as AfterContactLabel[]
  return (
    <FigureFrame
      id="after-contact"
      copy={copy}
      layouts={AFTER_CONTACT_VIEWBOX}
      driver="time"
      className={s.fig}
      drawing={
        <LazyDrawing
          src={drawingSrc('after-contact', 'wide.json')}
          tallSrc={drawingSrc('after-contact', 'tall.json')}
          stillSrc={drawingSrc('after-contact', 'wide.flow.still.svg')}
        />
      }
      labels={keys.map((k) => (
        <span
          key={k}
          data-anchor={k}
          className={s.label}
          style={
            {
              '--lx': at[k].lx,
              '--ly': at[k].ly,
              '--lxt': at[k].lxt,
              '--lyt': at[k].lyt,
            } as CSSProperties
          }
        >
          {copy.labels[k]}
        </span>
      ))}
      still={
        <>
          <img
            src={drawingSrc('after-contact', 'wide.flow.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="wide"
          />
          <img
            src={drawingSrc('after-contact', 'tall.flow.still.svg')}
            alt=""
            loading="lazy"
            className="still-img"
            data-family="tall"
          />
        </>
      }
    >
      <AfterContactController />
    </FigureFrame>
  )
}
