import { describe, expect, it } from 'vitest'
import { frameHouse } from '@/lib/framing/frame'
import {
  aabb,
  axisBox,
  between,
  corners,
  faceClashes,
  flatPose,
  obbOverlap,
  rot90,
  tiltPose,
  wAxis,
  type Box,
} from '@/lib/framing/geom3'
import { EXT_HEADER, FLAT_HEADER, PLY, SECTIONS } from '@/lib/framing/spec'
import { chooseJoints, piecesBetween } from '@/lib/framing/splice'
import type { Member } from '@/lib/framing/types'
import { cross } from '@/lib/framing/vec3'
import { capLayout, capRuns } from '@/lib/framing/walls'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse, type ResolvedWall } from '@/lib/house/resolve'

const house = resolveHouse(HOUSE_NO_1)
const frame = frameHouse(house)
const sixteens = Array.from({ length: 40 }, (_, k) => 16 * k)

const sSpan = (w: ResolvedWall, m: Box) => {
  const [lo, hi] = aabb(m)
  const k = w.axis === 'x' ? 0 : 1
  return [lo[k], hi[k]] as const
}
const ofWall = (id: string, kind?: Member['kind']) =>
  frame.members.filter((m) => m.wall === id && (!kind || m.kind === kind))

describe('chooseJoints', () => {
  it('leaves a run that fits its stock in one piece', () => {
    expect(chooseJoints(0, 192, 192, [96])).toEqual([])
    expect(piecesBetween(0, 192, [])).toEqual([[0, 192]])
  })

  it('uses the fewest pieces, then the shortest longest piece', () => {
    expect(chooseJoints(0, 576, 192, sixteens)).toEqual([192, 384])
    expect(chooseJoints(5.5, 378.5, 192, sixteens)).toEqual([192])
    expect(piecesBetween(0, 576, [192, 384])).toEqual([
      [0, 192],
      [192, 384],
      [384, 576],
    ])
  })

  it('keeps joints 24″ from the cap joints (R602.3.2)', () => {
    expect(chooseJoints(0, 384, 192, sixteens, [192])).toEqual([128, 256])
  })

  it('keeps the earlier joint on a tie', () => {
    expect(chooseJoints(0, 300, 240, [103, 197])).toEqual([103])
  })

  it('throws when no layout exists', () => {
    expect(() => chooseJoints(0, 400, 192, [100, 300])).toThrow(/Cannot splice/)
  })
})

describe('caps (House No. 1)', () => {
  const runs = (id: string) => capRuns(capLayout(house).get(id)!)

  it('lap across corners and tees; at a cross the first wall in spec order laps', () => {
    expect(runs('bed2-bed3')).toEqual([
      [0, 78.75],
      [82.25, 157.75],
    ])
    expect(runs('clo2-end')).toEqual([[125.75, 157.75]]) // laps both its hosts
    expect(runs('clo3-end')).toEqual([[157.75, 186.25]]) // stops at bed2-bed3's face
    expect(runs('bath-wic')).toEqual([[160.25, 249.75]])
    expect(runs('bath2-laundry')).toEqual([[249.75, 313.75]]) // stops at the wet wall's face
    expect(runs('wet')).toEqual([
      [196.25, 298.25],
      [301.75, 384],
    ])
  })

  it('match the framing table: top-plate joints, then cap runs spliced 24″ clear of them', () => {
    const table: Record<string, { top: number[]; caps: number[][] }> = {
      'ext-s': {
        top: [192, 384],
        caps: [
          [5.5, 154.25],
          [157.75, 310.25],
          [313.75, 448],
          [448, 570.5],
        ],
      },
      'ext-n': {
        top: [192, 384],
        caps: [
          [5.5, 160.25],
          [163.75, 244.25],
          [249.75, 310.25],
          [313.75, 448],
          [448, 570.5],
        ],
      },
      'ext-e': {
        top: [192],
        caps: [
          [0, 128],
          [128, 256],
          [256, 384],
        ],
      },
      'ext-w': {
        top: [128, 256],
        caps: [
          [0, 154.25],
          [157.75, 196.25],
          [199.75, 384],
        ],
      },
      'hall-s': {
        top: [101.5, 213.5],
        caps: [
          [0, 125.75],
          [129.25, 154.25],
          [157.75, 182.75],
          [186.25, 310.25],
        ],
      },
      'hall-n': {
        top: [133.5],
        caps: [
          [0, 160.25],
          [163.75, 244.25],
          [249.75, 310.25],
        ],
      },
    }
    for (const [id, want] of Object.entries(table)) {
      const w = house.wall(id)
      const tops = ofWall(id, 'plate-top').map((m) => sSpan(w, m))
      expect(
        tops.slice(1).map((s) => s[0]),
        id,
      ).toEqual(want.top)
      expect(
        ofWall(id, 'plate-cap').map((m) => [...sSpan(w, m)]),
        id,
      ).toEqual(want.caps)
    }
  })
})

describe('walls (House No. 1)', () => {
  it('slides backing studs that hit a king toward the landing wall', () => {
    const slid: string[] = []
    for (const w of house.walls)
      for (const m of ofWall(w.spec.id, 'stud')) {
        const landing = /\/stud\/(.+)-(lo|hi)$/.exec(m.id)
        if (!landing || landing[1] === 'end') continue
        const c = w.contacts.find((x) => x.wall === landing[1] && x.kind !== 'butt')!
        const s = sSpan(w, m)
        const plain = landing[2] === 'lo' ? c.s0 - PLY : c.s1
        if (s[0] !== plain) slid.push(`${m.id} [${s.join(', ')}]`)
      }
    expect(slid).toEqual([
      'ext-s/stud/bed3-great-hi [312.5, 314]',
      'hall-s/stud/clo2-front-lo [125, 126.5]',
      'hall-s/stud/clo3-front-hi [185.5, 187]',
      'hall-n/stud/primary-e-lo [159, 160.5]',
      'primary-e/stud/bath-wic-lo [297, 298.5]',
      'primary-e/stud/bath-wic-hi [301.5, 303]',
      'laundry-great/stud/bath2-laundry-hi [301.5, 303]',
    ])
  })

  it('merges the back-to-back backing in the wet wall', () => {
    const backing = ofWall('wet', 'stud').filter((m) => !/\/(end-lo|end-hi|k\d+)$/.test(m.id))
    expect(backing.map((m) => [...sSpan(house.wall('wet'), m)])).toEqual([
      [296.75, 298.25],
      [301.75, 303.25],
    ])
  })

  it('gives the 6′ slider two jacks a side; exterior headers are two 2x12 plies, interior ones a flat 2x', () => {
    expect(ofWall('ext-e', 'jack').filter((m) => m.opening === 'D02').length).toBe(4)
    expect(
      frame.members
        .filter((m) => m.kind === 'jack' && m.opening !== 'D02')
        .every((m) => /-1$/.test(m.id)),
    ).toBe(true)
    for (const w of house.walls)
      for (const h of ofWall(w.spec.id, 'header')) {
        const [lo, hi] = aabb(h)
        const t = w.axis === 'x' ? [lo[1], hi[1]] : [lo[0], hi[0]]
        if (w.spec.kind === 'exterior') {
          expect(h.section).toBe(EXT_HEADER.section)
          expect(hi[2] - lo[2]).toBe(SECTIONS['2x12'][1])
          expect(t[1] - t[0]).toBe(PLY)
          expect(t[0] === w.t0 || t[1] === w.t1, h.id).toBe(true)
        } else {
          expect([h.section, t[1] - t[0], hi[2] - lo[2]]).toEqual([w.asm.stud, w.asm.depth, PLY])
          expect(frame.datums.studTop - hi[2]).toBeLessThanOrEqual(FLAT_HEADER.gap) // R602.7.4
        }
      }
  })

  it('hinges each exterior wall on the inner top edge of its bottom plate', () => {
    const tilts = frame.assemblies.filter((a) => a.tilt).map((a) => a.tilt!)
    expect(tilts).toEqual([
      { wall: 'ext-n', batch: 0, pivot: [288, 378.5, 1.5], axis: [1, 0, 0], inward: [0, -1, 0] },
      { wall: 'ext-s', batch: 0, pivot: [288, 5.5, 1.5], axis: [-1, 0, 0], inward: [0, 1, 0] },
      { wall: 'ext-w', batch: 1, pivot: [5.5, 192, 1.5], axis: [0, 1, 0], inward: [1, 0, 0] },
      { wall: 'ext-e', batch: 1, pivot: [570.5, 192, 1.5], axis: [0, -1, 0], inward: [-1, 0, 0] },
    ])
  })

  it('lays each frame flat on the deck, outside face up, over its own strip of floor', () => {
    const flat = Object.fromEntries(
      frame.assemblies
        .filter((a) => a.tilt)
        .map((a) => {
          const boxes = a.members.map((i) => flatPose(frame.members[i], a.tilt!))
          const all = boxes.map(aabb)
          const lo = [0, 1, 2].map((k) => Math.min(...all.map((b) => b[0][k])))
          const hi = [0, 1, 2].map((k) => Math.max(...all.map((b) => b[1][k])))
          return [a.tilt!.wall, [lo, hi]]
        }),
    )
    expect(flat).toEqual({
      'ext-n': [
        [0, 272.375, 1.5],
        [576, 378.5, 7],
      ],
      'ext-s': [
        [0, 5.5, 1.5],
        [576, 111.625, 7],
      ],
      'ext-w': [
        [5.5, 5.5, 1.5],
        [111.625, 378.5, 7],
      ],
      'ext-e': [
        [464.375, 5.5, 1.5],
        [570.5, 378.5, 7],
      ],
    })
    // The outside face (t = 0 for ext-s) ends up on top.
    const stud = ofWall('ext-s', 'stud')[0]
    const up = flatPose(stud, frame.assemblies.find((a) => a.id === 'wall/ext-s')!.tilt!)
    expect(Math.max(...corners(up).map((p) => p[2]))).toBe(7)
  })

  it('raises through walls first: a butting wall standing in the corner would be hit', () => {
    const s = frame.assemblies.find((a) => a.id === 'wall/ext-s')!
    const w = frame.assemblies.find((a) => a.id === 'wall/ext-w')!
    let hits = 0
    for (let deg = 0; deg <= 90; deg += 15) {
      const posed = s.members.map((i) => tiltPose(frame.members[i], s.tilt!, (deg * Math.PI) / 180))
      for (const p of posed)
        for (const i of w.members) if (obbOverlap(p, frame.members[i]) > 1e-6) hits++
    }
    expect(hits).toBeGreaterThan(0)
  })
})

describe('geom3', () => {
  it('builds right-handed axis boxes with the grain along u', () => {
    for (const grain of ['x', 'y', 'z'] as const) {
      const b = axisBox([1, 2, 3], [5, 8, 12], grain)
      expect(wAxis(b)).toEqual(cross(b.u, b.v))
      expect(aabb(b)).toEqual([
        [1, 2, 3],
        [5, 8, 12],
      ])
      expect(b.size[0]).toBe({ x: 4, y: 6, z: 9 }[grain])
    }
  })

  it('turns exactly by a quarter about axis-aligned hinges', () => {
    expect(rot90([-1, 0, 0], [0, 0, 1])).toEqual([0, 1, 0])
    expect(rot90([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
    const m = axisBox([0, 0, 1.5], [1.5, 5.5, 106.125], 'z')
    const t = {
      wall: 'w',
      batch: 0,
      pivot: [0, 5.5, 1.5],
      axis: [-1, 0, 0],
      inward: [0, 1, 0],
    } as const
    expect(aabb(flatPose(m, t))).toEqual([
      [0, 5.5, 1.5],
      [1.5, 110.125, 7],
    ])
    const half = aabb(tiltPose(m, t, Math.PI / 4))
    expect(half[0][2]).toBeGreaterThanOrEqual(1.5 - 1e-9)
  })

  it('tells touching boxes from interpenetrating ones', () => {
    const a = axisBox([0, 0, 0], [10, 10, 10], 'x')
    expect(obbOverlap(a, axisBox([10, 0, 0], [20, 10, 10], 'x'))).toBeLessThanOrEqual(0)
    expect(obbOverlap(a, axisBox([9, 2, 2], [20, 8, 8], 'x'))).toBeCloseTo(1, 12)
    // A diagonal brace through the box's corner, and one that clears it.
    expect(obbOverlap(a, between([5, 5, 12], [12, 12, 5], [0, 0, 1], 1, 1))).toBeGreaterThan(0)
    expect(obbOverlap(a, between([8, 14, 5], [14, 8, 5], [0, 0, 1], 1, 1))).toBeLessThanOrEqual(0)
  })

  it('finds co-planar, same-facing faces that share area, and nothing else', () => {
    const a = axisBox([0, 0, 0], [10, 10, 1], 'x')
    expect(faceClashes([a, axisBox([5, 0, 0], [15, 10, 1], 'x')])).toEqual([[0, 1]])
    expect(faceClashes([a, axisBox([0, 0, 1], [10, 10, 2], 'x')])).toEqual([]) // stacked: faces oppose, sides meet at an edge
    expect(faceClashes([a, axisBox([10, 0, 0], [20, 10, 1], 'x')])).toEqual([]) // butted end to end
    expect(faceClashes([a, axisBox([2, 2, 1 / 32], [8, 8, 1 - 1 / 32], 'x')])).toEqual([]) // thinned 1/32″
    // Two sloped members crossing in one plane fight unless one is thinner.
    const p = between([0, 0, 0], [0, 20, 10], [1, 0, 0], 1.5, 3.5)
    expect(faceClashes([p, between([0, 0, 10], [0, 20, 0], [1, 0, 0], 1.5, 3.5)])).toEqual([[0, 1]])
    expect(faceClashes([p, between([0, 0, 10], [0, 20, 0], [1, 0, 0], 1.5 - 1 / 16, 3.5)])).toEqual(
      [],
    )
  })
})
