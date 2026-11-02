import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { area } from '@/lib/geom/rect'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { inCharset } from '@/lib/plan/charset'
import { planDrawing } from '@/lib/plan/drawing'
import { PALETTE } from '@/lib/plan/pens'
import { MARKS } from '@/lib/draft/script'

const house = resolveHouse(HOUSE_NO_1)
const plan = planDrawing(house)

const dimTexts = (id: string) => {
  const e = plan.index.get(`dim:${id}`)
  return plan.labels.filter((l) => l.el === e).map((l) => l.text)
}

describe('planDrawing', () => {
  it('is deterministic', () => {
    expect(planDrawing(resolveHouse(HOUSE_NO_1))).toEqual(plan)
  })

  it('reads the right dimensions', () => {
    expect(dimTexts('dim-n-1')).toEqual(['13′-6″', '7′-1″', '5′-5″', '22′-0″'])
    expect(dimTexts('dim-n-2')).toEqual(['48′-0″'])
    expect(dimTexts('dim-w-1')).toEqual(['13′-0″', '3′-6″', '15′-6″'])
    expect(dimTexts('dim-w-2')).toEqual(['32′-0″'])
    expect(dimTexts('dim-int-1')).toEqual(['13′-0″', '13′-0″'])
  })

  it('labels rooms with names and sizes', () => {
    const texts = plan.labels.map((l) => l.text)
    for (const t of ['GREAT ROOM', 'KITCHEN', 'BEDROOM 2', 'BEDROOM 3', 'PRIMARY', '21′-4″ × 21′-0″', '12′-8″ × 12′-4″'])
      expect(texts).toContain(t)
  })

  it('only uses characters the label font has', () => {
    const bad = plan.labels.filter((l) => !inCharset(l.text)).map((l) => l.text)
    expect(bad).toEqual([])
  })

  it('fills exactly the walls minus their rough openings', () => {
    const poche = plan.fills.filter((f) => f.kind === 'poche')
    const sum = poche.reduce((s, f) => s + polyArea(f.poly), 0)
    const walls = house.walls.reduce((s, w) => s + area(w.spec.rect), 0)
    const cuts = house.walls.reduce((s, w) => s + w.openings.reduce((t, o) => t + area(o.cut), 0), 0)
    expect(sum).toBeCloseTo(walls - cuts, 6)
  })

  it('draws a cut line for every outline piece, once', () => {
    const cut = plan.strokes.filter((s) => s.pen === 'cut')
    expect(cut).toHaveLength(house.outline.length)
  })

  it('has well-formed strokes and fills', () => {
    for (const s of plan.strokes) {
      expect(s.pts.length).toBeGreaterThanOrEqual(2)
      for (const [x, y] of s.pts) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    }
    for (const f of plan.fills) expect(polyArea(f.poly)).toBeGreaterThan(0)
  })

  it('has a chip window for every mark', () => {
    expect(new Set(plan.marks.map((m) => m.id))).toEqual(new Set(MARKS.map((m) => m.id)))
  })

  it('states code clearances in inches, from the spec', () => {
    const text = (id: string) => plan.marks.find((m) => m.id === id)?.text
    expect(text('hall')).toBe('R311 HALL · 37½″ ≥ 36″')
    expect(text('door')).toBe('R311 DOOR · 33½″ CLR ≥ 32″')
    expect(text('egress')).toBe('R310 EGRESS · 3 BEDROOMS · 10.5 SF ≥ 5.7')
    expect(plan.marks.find((m) => m.id === 'alarms')?.then).toBe('R314 · 4 ALARMS ADDED')
  })

  it('keeps labels clear of window tags and the north arrow', () => {
    const pxPerIn = 1.1
    const em = { name: 12, size: 10, dim: 10, tag: 10, note: 10 } as const
    const obstacles = plan.strokes
      .filter((s) => s.beat === 'labels')
      .map((s) => {
        const xs = s.pts.map((p) => p[0])
        const ys = s.pts.map((p) => p[1])
        return { el: s.el, r: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const }
      })
    const clashes: string[] = []
    for (const l of plan.labels) {
      if (l.rot === 90) continue
      const h = em[l.size] / pxPerIn
      const w = l.text.length * 0.5 * h
      const cy = l.anchor.y === 'bottom' ? l.at[1] + h / 2 : l.anchor.y === 'top' ? l.at[1] - h / 2 : l.at[1]
      const r = [l.at[0] - w / 2, cy - h / 2, l.at[0] + w / 2, cy + h / 2] as const
      for (const o of obstacles)
        if (o.el !== l.el && r[0] < o.r[2] && o.r[0] < r[2] && r[1] < o.r[3] && o.r[1] < r[3])
          clashes.push(`${l.text} / ${plan.elements[o.el].id}`)
    }
    expect(clashes).toEqual([])
  })

  it('keeps label boxes apart at desktop scale', () => {
    // ~1.1 px per inch at 1440×900; troika advances ≈0.5 em per character in this condensed face.
    const pxPerIn = 1.1
    const em = { name: 12, size: 10, dim: 10, tag: 10, note: 10 } as const
    const boxes = plan.labels.map((l) => {
      const h = em[l.size] / pxPerIn
      const w = l.text.length * 0.5 * h
      const [W, H] = l.rot === 90 ? [h, w] : [w, h]
      const cx = l.anchor.x === 'center' ? l.at[0] : l.at[0]
      const cy =
        l.rot === 90
          ? l.at[1]
          : l.anchor.y === 'bottom'
            ? l.at[1] + H / 2
            : l.anchor.y === 'top'
              ? l.at[1] - H / 2
              : l.at[1]
      const cxr = l.rot === 90 ? (l.anchor.y === 'bottom' ? l.at[0] - W / 2 : l.at[0]) : cx
      return { l, r: [cxr - W / 2, cy - H / 2, cxr + W / 2, cy + H / 2] as const }
    })
    const clashes: string[] = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r
        const b = boxes[j].r
        if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) clashes.push(`${boxes[i].l.text} / ${boxes[j].l.text}`)
      }
    expect(clashes).toEqual([])
  })

  it('matches the palette in globals.css', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')
    const vars: Record<keyof typeof PALETTE, string> = {
      paper: '--paper',
      ink: '--ink',
      poche: '--poche',
      graphite: '--graphite',
      text2: '--text-2',
      pencil: '--pencil',
      construction: '--construction',
      rule: '--rule',
      gridMinor: '--grid-minor',
      ai: '--ai',
      aiGuide: '--ai-guide',
      aiWash: '--ai-wash',
    }
    for (const [key, name] of Object.entries(vars)) {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))
      expect(m?.[1].toLowerCase(), name).toBe(PALETTE[key as keyof typeof PALETTE])
    }
  })
})

function polyArea(pts: readonly (readonly [number, number])[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    s += x0 * y1 - x1 * y0
  }
  return s / 2
}
