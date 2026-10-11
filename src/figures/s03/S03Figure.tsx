import { s03Figure as copy } from '@/content/figures/s03'
import { FigureFrame } from '@/figures/FigureFrame'
import { LazyDrawing } from '@/figures/LazyDrawing.client'

/** W0 stub of the s03 figure (owner: scenes-b): the fixture drawing in a working frame. */
export function S03Figure() {
  return (
    <FigureFrame
      id="s03"
      copy={copy}
      layouts={{ wide: [0, 0, 960, 720], tall: [0, 0, 400, 500] }}
      driver="scroll"
      stage={{ scene: 's03', load: 'near', mode: 'scrub' }}
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
