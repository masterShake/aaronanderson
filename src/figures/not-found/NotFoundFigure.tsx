import type { CSSProperties } from 'react'
import { notFoundFigure as copy } from '@/content/figures/not-found'
import { FigureFrame } from '@/figures/FigureFrame'
import { primD } from '@/drawings/lib/geometry'
import { cloudPrim, deltaTag } from '@/drawings/symbols'

const WIDE = [0, 0, 960, 540] as const
const TALL = [0, 0, 400, 400] as const

type Fam = 'wide' | 'tall'

/** Where the sheet, its title block and the margin note sit, per family (user units). */
function plan(family: Fam) {
  const [, , w, h] = family === 'wide' ? WIDE : TALL
  const m = family === 'wide' ? 120 : 52
  const x1 = w - m
  const y1 = h - m * (family === 'wide' ? 1.05 : 1.15)
  const bw = family === 'wide' ? 240 : 112
  const bh = family === 'wide' ? 70 : 52
  return { w, h, m, x1, y1, bx: x1 - bw, by: y1 - bh, bw, bh }
}

/**
 * The empty sheet: a frame with an inner border, the title block (a project
 * strip over the sheet-number cell, with three ruled rows on its left), border
 * ticks, and the redline revision cloud around it all with its delta tag.
 * Static (B12 item 7: no draw-on), so the still tier shows the same drawing.
 */
function Sheet({ family }: { family: Fam }) {
  const p = plan(family)
  const { w, h, m, x1, y1, bx, by, bw, bh } = p
  const i = family === 'wide' ? 10 : 6
  const split = by + bh * 0.38
  const col = bx + bw * (family === 'wide' ? 0.42 : 0.001)
  const ticks: string[] = []
  const n = family === 'wide' ? 6 : 4
  for (let k = 1; k < n; k++) {
    const x = m + ((x1 - m) * k) / n
    ticks.push(`M${x} ${m}V${m + i}M${x} ${y1 - i}V${y1}`)
  }
  for (let k = 1; k < 4; k++) {
    const y = m + ((y1 - m) * k) / 4
    ticks.push(`M${m} ${y}H${m + i}M${x1 - i} ${y}H${x1}`)
  }
  const rows =
    family === 'wide'
      ? [1, 2]
          .map((k) => {
            const y = split + ((by + bh - split) * k) / 3
            return `M${bx} ${y}H${col}`
          })
          .join('')
      : ''
  const inset = family === 'wide' ? 18 : 10
  const cloud = cloudPrim(
    { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 },
    { seed: family === 'wide' ? 7 : 11 },
  )
  const delta = deltaTag([inset + 10, inset + 12], family === 'wide' ? 22 : 18)
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
        d={`M${m} ${m}H${x1}V${y1}H${m}Z M${bx} ${y1}V${by}H${x1}`}
        fill="none"
        stroke="currentColor"
      />
      <path
        className="pen-035 ink-asphalt"
        d={`M${m + i} ${m + i}H${x1 - i}V${by}M${bx} ${y1 - i}H${m + i}V${m + i} M${bx} ${split}H${x1}${family === 'wide' ? `M${col} ${split}V${y1}` : ''}`}
        fill="none"
        stroke="currentColor"
      />
      <path
        className="pen-018 ink-graphite"
        d={`${ticks.join('')}${rows}`}
        fill="none"
        stroke="currentColor"
      />
      <path className="pen-070 ink-redline" d={primD(cloud)} fill="none" stroke="currentColor" />
      <path
        className="pen-050 ink-redline"
        d={primD(delta)}
        fill="var(--c-paper)"
        stroke="currentColor"
      />
    </svg>
  )
}

function Drawing() {
  return (
    <>
      <Sheet family="wide" />
      <Sheet family="tall" />
    </>
  )
}

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

/** The sheet number in its cell and the one margin note. */
function Labels() {
  const pw = plan('wide')
  const pt = plan('tall')
  const at = (
    k: string,
    wide: readonly [number, number],
    tall: readonly [number, number],
  ): CSSProperties =>
    ({
      '--lx': pct(wide[0], pw.w),
      '--ly': pct(wide[1], pw.h),
      '--lxt': pct(tall[0], pt.w),
      '--lyt': pct(tall[1], pt.h),
      '--tilt': k === 'note' ? '-3deg' : '0deg',
    }) as CSSProperties
  const splitW = pw.by + pw.bh * 0.38
  const splitT = pt.by + pt.bh * 0.38
  return (
    <>
      <span
        data-label="sheet"
        style={at('sheet', [pw.bx + pw.bw * 0.42 + 12, splitW + 10], [pt.bx + 8, splitT + 6])}
      >
        {copy.labels.sheet}
      </span>
      <span
        className="hand"
        data-label="note"
        style={at('note', [pw.m + 8, pw.y1 + 16], [pt.m + 2, pt.y1 + 10])}
      >
        {copy.notes.missing}
      </span>
    </>
  )
}

/**
 * The 404 figure (D6, §6.10b): a redline revision cloud around an empty sheet
 * frame with its title block, the sheet number left blank and one margin note.
 * Static, so the still tier shows the same drawing.
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
      labels={<Labels />}
    />
  )
}
