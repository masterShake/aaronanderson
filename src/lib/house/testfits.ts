/**
 * Test fits: three layouts of the same 48′ × 32′ box that the "AI" proposes in chapter 1.
 * B is House No. 1 itself; A and C are the alternatives it is compared against. Room rectangles
 * are finished coordinates, like HouseSpec rooms.
 */
import { area, type Rect } from '@/lib/geom/rect'
import type { HouseSpec } from '@/lib/house/types'
import { sqft } from '@/lib/units'

export type TestFitId = 'A' | 'B' | 'C'

export interface TestFitRoom {
  use: 'bed' | 'primary' | 'bath' | 'wic' | 'hall' | 'laundry' | 'great' | 'kitchen'
  rect: Rect
}

export interface TestFit {
  id: TestFitId
  rooms: readonly TestFitRoom[]
  /** Trailing note for the chip, after the computed hall area. */
  note: string
}

const r = (use: TestFitRoom['use'], x0: number, y0: number, x1: number, y1: number): TestFitRoom => ({
  use,
  rect: [x0, y0, x1, y1],
})

export const TEST_FIT_A: TestFit = {
  id: 'A',
  note: 'BATHS APART',
  rooms: [
    r('bed', 6, 6, 150, 150),
    r('bed', 150, 6, 294, 150),
    r('primary', 294, 6, 474, 150),
    r('bath', 474, 6, 570, 78),
    r('wic', 474, 78, 570, 150),
    r('hall', 6, 150, 570, 192),
    r('bath', 6, 192, 96, 282),
    r('laundry', 6, 282, 96, 378),
    r('great', 96, 192, 366, 378),
    r('kitchen', 366, 192, 570, 378),
  ],
}

export const TEST_FIT_C: TestFit = {
  id: 'C',
  note: 'KITCHEN ON THE STREET',
  rooms: [
    r('great', 6, 6, 330, 198),
    r('kitchen', 330, 6, 570, 198),
    r('hall', 150, 198, 474, 240),
    r('bed', 6, 198, 150, 378),
    r('bed', 150, 240, 294, 378),
    r('bath', 294, 240, 366, 378),
    r('primary', 366, 240, 570, 378),
  ],
}

const USE: Record<string, TestFitRoom['use'] | undefined> = {
  bedroom: 'bed',
  bath: 'bath',
  hall: 'hall',
  laundry: 'laundry',
  living: 'great',
  kitchen: 'kitchen',
}

/** Test fit B is the real house: its rooms minus closets and the porch. */
export function testFitB(spec: HouseSpec): TestFit {
  return {
    id: 'B',
    note: 'BATHS BACK-TO-BACK',
    rooms: spec.rooms.flatMap((room) => {
      const use = room.id === 'primary' ? 'primary' : room.id === 'wic' ? 'wic' : USE[room.use]
      return use ? [{ use, rect: room.rect }] : []
    }),
  }
}

/** Hall area in square feet, rounded half up (shown on the test-fit chips). */
export const hallArea = (fit: TestFit): number =>
  Math.round(sqft(fit.rooms.filter((x) => x.use === 'hall').reduce((s, x) => s + area(x.rect), 0)))

export const testFitChip = (fit: TestFit): string => `${fit.id} · HALL ${hallArea(fit)} SF · ${fit.note}`

export const testFits = (spec: HouseSpec): readonly TestFit[] => [TEST_FIT_A, testFitB(spec), TEST_FIT_C]
