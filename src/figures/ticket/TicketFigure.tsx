import { ticketFigure as copy } from '@/content/figures/ticket'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'

/** W0 stub of the ticket figure (owner: how): the fixture drawing in a working frame. */
export function TicketFigure() {
  return (
    <FigureFrame
      id="ticket"
      copy={copy}
      layouts={{ wide: [0, 0, 960, 640], tall: [0, 0, 400, 480] }}
      driver="steps"
      drawing={
        <LazyDrawing
          src="/drawings/_fixture.wide.json"
          tallSrc="/drawings/_fixture.tall.json"
          stillSrc="/drawings/_fixture.wide.still.svg"
        />
      }
      still={
        <img src="/drawings/_fixture.wide.still.svg" alt="" loading="lazy" className="still-img" />
      }
    />
  )
}
