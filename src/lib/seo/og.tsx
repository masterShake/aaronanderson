import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { site } from '@/content/site'
import { seo } from '@/content/seo'
import type { PageKey } from '@/content/types'
import { COLOR } from '@/styles/tokens'

/**
 * The Open Graph card every sheet shares: a drawing sheet on paper with a faint
 * grid, the sheet kicker, the page's OG title and an asphalt title block with
 * the wordmark. Satori takes flexbox only (no grid) and TTF fonts, so the faces
 * come from the static TTFs in src/assets/og. All copy comes from src/content.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const

const font = (file: string) => readFile(join(process.cwd(), 'src/assets/og', file))

const [display, mono, body] = await Promise.all([
  font('big-shoulders-800.ttf'),
  font('martian-mono-semicondensed-500.ttf'),
  font('archivo-semiexpanded-400.ttf'),
])

const FONTS = [
  { name: 'Display', data: display, weight: 800 as const, style: 'normal' as const },
  { name: 'Mono', data: mono, weight: 500 as const, style: 'normal' as const },
  { name: 'Body', data: body, weight: 400 as const, style: 'normal' as const },
]

const PAD = 40
const GRID = 30

/** One SVG path for the faint drawing grid inside the sheet border. */
function gridPath(w: number, h: number) {
  const d: string[] = []
  for (let x = GRID; x < w; x += GRID) d.push(`M${x} 0V${h}`)
  for (let y = GRID; y < h; y += GRID) d.push(`M0 ${y}H${w}`)
  return d.join('')
}

/** The junction-box mark from the wordmark, drawn at `px`. */
function Mark({ px, color }: { px: number; color: string }) {
  return (
    <svg width={px} height={px} viewBox="0 0 18 18">
      <path
        d="M9 1 17 5v8l-8 4-8-4V5z M1 5l8 4 8-4 M9 9v8"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** The OG image for one of the five sheets. */
export function ogImage(key: PageKey): ImageResponse {
  const og = seo[key].og
  const innerW = OG_SIZE.width - PAD * 2
  const innerH = OG_SIZE.height - PAD * 2
  const host = new URL(site.url).host
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: COLOR.paper,
        padding: PAD,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: innerW,
          height: innerH,
          border: `3px solid ${COLOR.asphalt}`,
        }}
      >
        <svg
          width={innerW - 6}
          height={innerH - 6}
          viewBox={`0 0 ${innerW - 6} ${innerH - 6}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <path d={gridPath(innerW - 6, innerH - 6)} stroke={COLOR.cyan} strokeWidth="1" />
        </svg>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
            padding: '40px 56px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Mono',
              fontSize: 26,
              letterSpacing: '0.06em',
              color: COLOR.blueprint,
              marginBottom: 28,
            }}
          >
            {og.kicker}
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Display',
              fontSize: 112,
              lineHeight: 0.92,
              color: COLOR.asphalt,
              maxWidth: 980,
            }}
          >
            {og.title}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 96,
            padding: '0 40px',
            background: COLOR.asphalt,
            color: COLOR.paper,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Mark px={40} color={COLOR.paper} />
            <div
              style={{
                display: 'flex',
                marginLeft: 18,
                fontFamily: 'Body',
                fontSize: 30,
                letterSpacing: '0.12em',
              }}
            >
              {site.wordmark}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Mono',
                fontSize: 22,
                color: COLOR.alu300,
                marginRight: 22,
              }}
            >
              {host}
            </div>
            <div style={{ display: 'flex', width: 18, height: 18, background: COLOR.orange }} />
          </div>
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: FONTS },
  )
}

/** The square brand icon (apple-icon, logo): the mark in paper on asphalt. */
export function iconImage(px: number): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLOR.asphalt,
      }}
    >
      <Mark px={Math.round(px * 0.62)} color={COLOR.paper} />
    </div>,
    { width: px, height: px },
  )
}
