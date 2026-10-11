import { notFoundFigure as copy } from '@/content/figures/not-found'
import { RevisionCloud } from '@/components/blueprint/RevisionCloud'
import { FigureFrame } from '@/figures/FigureFrame'

/** The 404 figure: a static revision cloud around an empty frame (owner: kit lane). */
export function NotFoundFigure() {
  return (
    <FigureFrame
      id="not-found"
      copy={copy}
      layouts={{ wide: [0, 0, 960, 640], tall: [0, 0, 400, 480] }}
      driver="time"
      drawing={<RevisionCloud width={960} height={640} />}
      still={null}
    />
  )
}
