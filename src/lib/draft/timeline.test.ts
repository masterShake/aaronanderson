import { describe, expect, it } from 'vitest'
import { dist } from '@/lib/geom/rect'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { BEATS, DRAWN_BY } from '@/lib/draft/script'
import { draftTimeline, penAt, polylineLength, segmentWindows } from '@/lib/draft/timeline'
import { planDrawing } from '@/lib/plan/drawing'

const plan = planDrawing(resolveHouse(HOUSE_NO_1))
const tl = draftTimeline(plan)
const win = (i: number) => [tl.strokes[i * 2], tl.strokes[i * 2 + 1]] as const

describe('draftTimeline', () => {
  it('schedules every stroke inside its beat', () => {
    plan.strokes.forEach((s, i) => {
      const [t0, t1] = win(i)
      const beat = BEATS.find((b) => b.id === s.beat)
      expect(beat, s.beat).toBeDefined()
      expect(t0).toBeGreaterThanOrEqual((beat?.win[0] ?? 0) - 1e-6)
      expect(t1).toBeLessThanOrEqual((beat?.win[1] ?? 1) + 1e-6)
      expect(t1).toBeGreaterThanOrEqual(t0)
    })
  })

  it('draws nothing at p = 0 and everything by DRAWN_BY', () => {
    for (let i = 0; i < plan.strokes.length; i++) {
      expect(win(i)[0]).toBeGreaterThan(0)
      expect(win(i)[1]).toBeLessThanOrEqual(DRAWN_BY)
    }
    for (let i = 0; i < plan.fills.length; i++) expect(tl.fills[i * 2 + 1]).toBeLessThanOrEqual(DRAWN_BY)
    for (let i = 0; i < plan.labels.length; i++) expect(tl.labels[i * 2 + 1]).toBeLessThanOrEqual(DRAWN_BY + 0.01)
  })

  it('keeps each pen track sorted, non-overlapping and at constant speed', () => {
    for (const track of tl.tracks) {
      let prevEnd = -Infinity
      const speeds: number[] = []
      for (const i of track.strokes) {
        const [t0, t1] = win(i)
        expect(t0).toBeGreaterThanOrEqual(prevEnd - 1e-6)
        prevEnd = t1
        const len = polylineLength(plan.strokes[i].pts)
        if (len > 1) speeds.push(len / (t1 - t0))
      }
      const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length
      for (const v of speeds) expect(Math.abs(v - avg) / avg).toBeLessThan(1e-3)
    }
  })

  it('puts the pen exactly on the drawn tip', () => {
    for (const track of tl.tracks) {
      const i = track.strokes[Math.floor(track.strokes.length / 2)]
      const [t0, t1] = win(i)
      const p = t0 + (t1 - t0) * 0.37
      const pen = penAt(plan, tl, track, p)
      expect(pen?.down).toBe(true)
      // Same rule as the shader: find the segment whose window contains p and interpolate.
      const pts = plan.strokes[i].pts
      const seg = segmentWindows(pts, t0, t1)
      let tip = pts[pts.length - 1]
      for (let k = 0; k + 1 < pts.length; k++) {
        const s0 = seg[k * 2]
        const s1 = seg[k * 2 + 1]
        if (p >= s0 && p <= s1) {
          const kk = s1 > s0 ? (p - s0) / (s1 - s0) : 1
          tip = [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * kk, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * kk]
          break
        }
      }
      expect(dist(pen?.at ?? [0, 0], tip)).toBeLessThan(1e-3)
    }
  })

  it('splits stroke windows by segment length', () => {
    const w = segmentWindows(
      [
        [0, 0],
        [10, 0],
        [10, 30],
      ],
      0.2,
      0.6,
    )
    expect(Array.from(w)).toEqual([0.2, 0.3, 0.3, 0.6].map((v) => expect.closeTo(v, 6)))
  })
})
