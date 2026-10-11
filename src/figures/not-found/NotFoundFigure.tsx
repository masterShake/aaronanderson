import { notFoundFigure as copy } from '@/content/figures/not-found'
import { RevisionCloud } from '@/components/blueprint/RevisionCloud'
import { FigureFrame } from '@/figures/FigureFrame'

const WIDE = [0, 0, 960, 540] as const
const TALL = [0, 0, 400, 400] as const

/** An empty sheet frame (asphalt, 2 u) with a title-block cell at the bottom right. */
function EmptySheet({ w, h, family }: { w: number; h: number; family: 'wide' | 'tall' }) {
  const m = w * 0.14
  const cellW = w * 0.24
  const cellH = h * 0.12
  const x1 = w - m
  const y1 = h - m
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      data-family={family}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        className="pen-070 ink-asphalt"
        d={`M${m} ${m}H${x1}V${y1}H${m}Z M${x1 - cellW} ${y1}V${y1 - cellH}H${x1} M${x1 - cellW * 0.45} ${y1}V${y1 - cellH}`}
        fill="none"
        stroke="currentColor"
      />
    </svg>
  )
}

function Drawing() {
  return (
    <>
      <EmptySheet w={WIDE[2]} h={WIDE[3]} family="wide" />
      <EmptySheet w={TALL[2]} h={TALL[3]} family="tall" />
      <RevisionCloud width={WIDE[2]} height={WIDE[3]} tone="redline" />
    </>
  )
}

/**
 * The 404 figure (D6, §6.10b): a redline revision cloud around an empty sheet
 * frame. Static (B12 item 7: no draw-on), so the still tier shows the same
 * drawing. The cloud itself is the drawings lane's RevisionCloud.
 */
export function NotFoundFigure() {
  return (
    <FigureFrame
      id="not-found"
      copy={copy}
      layouts={{ wide: WIDE, tall: TALL }}
      driver="time"
      drawing={<Drawing />}
      still={<Drawing />}
    />
  )
}
