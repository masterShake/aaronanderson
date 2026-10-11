import { heroFigure as copy } from '@/content/figures/hero'
import { fixtureDoc } from '@/drawings/graphs/_fixture'
import { FigureFrame } from '@/figures/FigureFrame'
import { InlineDrawing } from '@/figures/InlineDrawing'

/** W0 stub of the hero figure (owner: hero lane): the only inline drawing, from the fixture. */
export function HeroFigure() {
  return (
    <FigureFrame
      id="hero"
      copy={copy}
      layouts={{ wide: [0, 0, 960, 640], tall: [0, 0, 400, 480] }}
      driver="time"
      stage={{ scene: 'hero', load: 'hero', mode: 'timeline' }}
      initialRev="asFound"
      controls={{ replay: true, motion: true }}
      drawing={<InlineDrawing doc={fixtureDoc('wide')} tall={fixtureDoc('tall')} />}
      still={
        <img src="/drawings/_fixture.wide.still.svg" alt="" loading="lazy" className="still-img" />
      }
    />
  )
}
