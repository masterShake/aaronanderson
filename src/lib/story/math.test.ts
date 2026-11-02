import { describe, expect, it } from 'vitest'
import { damp, parseP, scrollFor, storyTime } from '@/lib/story/math'

const spans = [
  { start: 900, len: 5400 },
  { start: 6300, len: 1800 },
  { start: 8100, len: 1800 },
  { start: 9900, len: 1800 },
  { start: 11700, len: 900 },
]

describe('story time', () => {
  it('is 0 before the story and N after it', () => {
    expect(storyTime(0, spans)).toBe(0)
    expect(storyTime(900, spans)).toBe(0)
    expect(storyTime(99999, spans)).toBe(5)
  })

  it('round-trips through scrollFor', () => {
    for (const s of [0, 0.25, 0.999, 1, 1.5, 2.75, 4.5]) expect(storyTime(scrollFor(s, spans), spans)).toBeCloseTo(s, 9)
  })

  it('maps progress through blocks of any height', () => {
    // A 1000px chapter whose first block (p 0 → 0.5) was stretched to 800px by CSS.
    const blocky = [
      {
        start: 0,
        len: 1000,
        blocks: [
          { start: 0, end: 800, p0: 0, p1: 0.5 },
          { start: 800, end: 1000, p0: 0.5, p1: 1 },
        ],
      },
      { start: 1000, len: 500 },
    ]
    expect(storyTime(400, blocky)).toBeCloseTo(0.25)
    expect(storyTime(900, blocky)).toBeCloseTo(0.75)
    expect(storyTime(1250, blocky)).toBeCloseTo(1.5)
    for (const s of [0.1, 0.5, 0.9, 1.2]) expect(storyTime(scrollFor(s, blocky), blocky)).toBeCloseTo(s, 9)
  })

  it('damps independently of frame rate', () => {
    let a = 0
    let b = 0
    for (let i = 0; i < 60; i++) a = damp(a, 1, 1 / 60)
    for (let i = 0; i < 30; i++) b = damp(b, 1, 1 / 30)
    expect(a).toBeCloseTo(b, 9)
  })

  it('parses deep links', () => {
    expect(parseP('?p=0.42')).toBeCloseTo(0.42)
    expect(parseP('?p=architects:0.42')).toBeCloseTo(0.42)
    expect(parseP('?p=trades:0.5')).toBeCloseTo(2.5)
    expect(parseP('?p=nope:0.5')).toBeNull()
    expect(parseP('?x=1')).toBeNull()
  })
})
