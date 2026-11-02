import { describe, expect, it } from 'vitest'
import { area } from '@/lib/geom/rect'
import { codeChecks } from '@/lib/house/code-checks'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { hallArea, testFitChip, testFits } from '@/lib/house/testfits'
import type { HouseSpec } from '@/lib/house/types'
import { validateHouse } from '@/lib/house/validate'
import { formatFtIn, formatSize, sqft } from '@/lib/units'

const clone = (): { -readonly [K in keyof HouseSpec]: HouseSpec[K] } => structuredClone(HOUSE_NO_1) as never

describe('House No. 1', () => {
  it('passes every invariant', () => {
    expect(validateHouse(HOUSE_NO_1)).toEqual([])
  })

  it('is 48′ × 32′, 1,536 SF, 3 BR, 2 BA', () => {
    expect(sqft(area(HOUSE_NO_1.footprint))).toBe(1536)
    expect(HOUSE_NO_1.rooms.filter((r) => r.use === 'bedroom')).toHaveLength(3)
    expect(HOUSE_NO_1.rooms.filter((r) => r.use === 'bath')).toHaveLength(2)
  })

  it('has the expected room sizes', () => {
    const house = resolveHouse(HOUSE_NO_1)
    const size = (id: string) => formatSize(...house.room(id).size)
    expect(size('bed2')).toBe('12′-4″ × 12′-4″')
    expect(size('bed3')).toBe('12′-8″ × 12′-4″')
    expect(size('primary')).toBe('12′-10″ × 14′-10″')
    expect(size('great')).toBe('21′-4″ × 21′-0″')
    expect(size('kitchen')).toBe('18′-0″ × 10′-0″')
    expect(house.room('bed2').area).toBeCloseTo(136.65, 2)
  })

  it('computes the code checks shown on screen', () => {
    const report = codeChecks(resolveHouse(HOUSE_NO_1))
    expect(report.pass).toBe(true)
    expect(report.egress.map((e) => [e.room, e.windows.map((w) => w.id)])).toEqual([
      ['bed2', ['W01', 'W10']],
      ['bed3', ['W02']],
      ['primary', ['W07', 'W08']],
    ])
    const w01 = report.egress[0].windows[0]
    expect(w01.area).toBeCloseTo(10.55, 2)
    expect(w01.sill).toBe(30)
    expect(report.hall[0].clear).toBe(37.5)
    expect(report.door).toEqual({ opening: 'D01', clear: 33.5, pass: true })
    expect(report.wc.map((w) => [w.fixture, w.sides, w.front])).toEqual([
      ['bath1.wc', [19.75, 19.75], 51.5],
      ['bath2.wc', [18, 15.75], 31.5],
    ])
    expect(report.wc[0].box).toEqual([194.75, 241, 243.75, 271])
    expect(report.wc[1].box).toEqual([250.25, 237, 299.25, 267])
    expect(report.alarms.every((a) => a.pass)).toBe(true)
    expect(report.alarms).toHaveLength(4)
  })

  it('records joins and openings the framing will need', () => {
    const house = resolveHouse(HOUSE_NO_1)
    const extS = house.wall('ext-s')
    expect(extS.contacts.filter((c) => c.kind === 'corner').map((c) => c.wall)).toEqual(['ext-w', 'ext-e'])
    expect(extS.contacts.filter((c) => c.kind === 'tee').map((c) => c.wall)).toEqual(['bed2-bed3', 'bed3-great'])
    expect(house.wall('ext-w').contacts.filter((c) => c.kind === 'butt').map((c) => c.wall).sort()).toEqual(['ext-n', 'ext-s'])
    const wet = house.wall('wet')
    expect(wet.contacts.filter((c) => c.kind === 'tee').map((c) => c.wall).sort()).toEqual(['bath-wic', 'bath2-laundry'])
    const d01 = house.opening('D01')
    expect([d01.s0, d01.s1, d01.head, d01.sill]).toEqual([317, 355, 82.5, 0])
    expect(extS.pieces.reduce((s, p) => s + area(p), 0)).toBe(area(extS.spec.rect) - 5.5 * (36.5 * 4 + 38))
  })

  it('formats feet and inches like a drawing', () => {
    expect(formatFtIn(162)).toBe('13′-6″')
    expect(formatFtIn(85)).toBe('7′-1″')
    expect(formatFtIn(37.5)).toBe('3′-1½″')
    expect(formatFtIn(9)).toBe('9″')
    expect(formatFtIn(147.75, 'inch')).toBe('12′-4″')
    expect(formatFtIn(151.5, 'inch')).toBe('12′-8″')
  })

  it('computes the test-fit chips', () => {
    expect(testFits(HOUSE_NO_1).map(hallArea)).toEqual([165, 80, 95])
    expect(testFitChip(testFits(HOUSE_NO_1)[1])).toBe('B · HALL 80 SF · BATHS BACK-TO-BACK')
  })
})

describe('validateHouse catches broken specs', () => {
  const rules = (spec: HouseSpec) => new Set(validateHouse(spec).map((i) => i.rule))

  it('off-grid numbers', () => {
    const s = clone()
    s.walls = s.walls.map((w) => (w.id === 'hall-s' ? { ...w, rect: [5.5, 154.25, 313.7, 157.75] } : w))
    expect(rules(s).has('sixteenth')).toBe(true)
  })

  it('wrong wall thickness and unjoined ends', () => {
    const s = clone()
    s.walls = s.walls.map((w) => (w.id === 'bed2-bed3' ? { ...w, rect: [154.25, 5.5, 158.25, 150] } : w))
    const r = rules(s)
    expect(r.has('wall-thickness')).toBe(true)
    expect(r.has('wall-end')).toBe(true)
  })

  it('openings too close to a tee', () => {
    const s = clone()
    s.openings = s.openings.map((o) => (o.id === 'D01' ? { ...o, at: 334 } : o))
    expect(rules(s).has('ro-tee')).toBe(true)
  })

  it('door swings into a fixture', () => {
    const s = clone()
    // Slide the laundry door north so its leaf sweeps the dryer.
    s.openings = s.openings.map((o) => (o.id === 'D11' ? { ...o, at: 340 } : o))
    expect(rules(s).has('swing')).toBe(true)
  })

  it('missing smoke alarm', () => {
    const s = clone()
    s.devices = s.devices.filter((d) => d.id !== 'alarm.bed3')
    expect(rules(s).has('code-R314')).toBe(true)
  })

  it('undersized egress window', () => {
    const s = clone()
    s.openings = s.openings.map((o) => (o.id === 'W02' && o.kind === 'window' ? { ...o, netClear: [20, 22] as const } : o))
    expect(rules(s).has('code-R310')).toBe(true)
  })

  it('a fixture clash', () => {
    const s = clone()
    s.fixtures = s.fixtures.map((f) => (f.id === 'bath2.wc' ? { ...f, rect: [250.25, 230, 278.25, 250] as const } : f))
    const r = rules(s)
    expect(r.has('fixture-clash') || r.has('code-R307')).toBe(true)
  })
})
