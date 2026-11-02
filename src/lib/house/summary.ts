/** Text derived from the spec: the title-strip project line and the drawing's text alternative. */
import { area } from '@/lib/geom/rect'
import type { HouseSpec } from '@/lib/house/types'
import { sqft } from '@/lib/units'

const count = (spec: HouseSpec, use: string) => spec.rooms.filter((r) => r.use === use).length

/** HOUSE NO. 1 · 1,536 SF · 3 BR · 2 BA */
export function projectLine(spec: HouseSpec): string {
  const sf = sqft(area(spec.footprint)).toLocaleString('en-US')
  return `${spec.meta.name} · ${sf} SF · ${count(spec, 'bedroom')} BR · ${count(spec, 'bath')} BA`
}

/** 2026-11-01 → 11.01.26 */
export function sheetDate(spec: HouseSpec): string {
  const [y, m, d] = spec.meta.date.split('-')
  return `${m}.${d}.${y.slice(2)}`
}

/** Screen-reader description of the finished drawing. */
export function houseSummary(spec: HouseSpec): string {
  const sf = sqft(area(spec.footprint)).toLocaleString('en-US')
  const name = spec.meta.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    `Floor plan of ${name}: a ${sf}-square-foot, one-story house with ${count(spec, 'bedroom')} bedrooms and ` +
    `${count(spec, 'bath')} baths. A covered porch faces south; the great room and kitchen are to the east; ` +
    `the bedrooms, both baths and the laundry open off a hall to the west.`
  )
}
