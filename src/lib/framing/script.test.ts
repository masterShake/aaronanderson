import { describe, expect, it } from 'vitest'
import { CAMERA as DRAFT_CAMERA } from '@/lib/draft/script'
import {
  AI_SETTLE,
  BLOCKS,
  blockAt,
  CAMERA,
  DISSOLVE,
  GRID_FADE,
  groundAt,
  PAPER_SPACE,
  paperSpace,
  PHASES,
  QUIET,
  quantize,
  SHEET_GONE,
  SHOTS,
  TILT,
  wallsForward,
  type Win,
} from '@/lib/framing/script'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { planDrawing } from '@/lib/plan/drawing'
import type { ElementKind } from '@/lib/plan/types'
import { chapterIndex } from '@/lib/story/chapters'

const KINDS: readonly ElementKind[] = [
  'setout',
  'testfit',
  'wall',
  'opening',
  'fixture',
  'room',
  'porch',
  'roof',
  'dim',
  'annotation',
  'check',
  'device',
]
const keyframes = BLOCKS.map((b) => b.keyframe)
const containsKeyframe = ([a, b]: Win) => keyframes.some((k) => a < k && k < b)
const block = (id: string) => BLOCKS.find((b) => b.id === id)!
const beat = (side: string) => TILT.find((t) => t.side === side)!

describe('blocks', () => {
  it('tile chapter progress, each keyframe inside its span', () => {
    expect(BLOCKS[0].span[0]).toBe(0)
    expect(BLOCKS.at(-1)!.span[1]).toBe(1)
    BLOCKS.forEach((b, i) => {
      if (i) expect(b.span[0]).toBe(BLOCKS[i - 1].span[1])
      expect(b.keyframe).toBeGreaterThan(b.span[0])
      expect(b.keyframe).toBeLessThanOrEqual(b.span[1])
    })
    expect(BLOCKS.map((b) => b.id)).toEqual(['intro', 'takeoffs', 'schedules', 'paperwork'])
  })

  it('quantizes to chapter 1’s sheet, then to each card’s keyframe', () => {
    expect(quantize(0)).toBe(0)
    expect(quantize(QUIET - 1e-6)).toBe(0)
    expect(quantize(QUIET)).toBe(0.3)
    for (const b of BLOCKS) {
      expect(quantize(Math.max(QUIET, b.span[0]))).toBe(b.keyframe)
      expect(quantize(b.span[1] - 1e-6)).toBe(b.keyframe)
      expect(blockAt((b.span[0] + b.span[1]) / 2)).toBe(BLOCKS.indexOf(b))
    }
    expect(quantize(1)).toBe(1)
  })
})

describe('phases', () => {
  it('play in order, inside their cards', () => {
    expect(PHASES.morph[1]).toBeLessThanOrEqual(PHASES.swing[0])
    expect(PHASES.floor[0]).toBeGreaterThan(PHASES.morph[0])
    expect(PHASES.floor[1]).toBeLessThanOrEqual(SHEET_GONE)
    expect(PHASES.pour[0]).toBeGreaterThanOrEqual(PHASES.floor[1])
    expect(PHASES.deck[0]).toBeGreaterThanOrEqual(PHASES.pour[0])
    expect(PHASES.deck[1] + AI_SETTLE).toBeLessThanOrEqual(block('intro').keyframe)
    expect(TILT[0].frame[0]).toBeGreaterThanOrEqual(block('takeoffs').span[0])
    expect(PHASES.caps[0]).toBeGreaterThanOrEqual(Math.max(...TILT.map((t) => t.raise[1])))
    expect(PHASES.caps[1] + AI_SETTLE).toBeLessThanOrEqual(block('takeoffs').keyframe)
    expect(PHASES.interior[0]).toBeGreaterThanOrEqual(block('schedules').span[0])
    expect(PHASES.trusses[0]).toBeGreaterThanOrEqual(PHASES.interior[1])
    expect(PHASES.trusses[1] + AI_SETTLE).toBeLessThanOrEqual(block('schedules').keyframe)
    expect(PHASES.porch[0]).toBeGreaterThanOrEqual(block('paperwork').span[0])
    expect(PHASES.porch[1] + AI_SETTLE).toBeLessThanOrEqual(1)
    for (const w of Object.values(PHASES)) expect(w[0]).toBeLessThan(w[1])
  })

  it('frame each exterior wall before raising it, one raise at a time, N, S, W, E', () => {
    expect(TILT.map((t) => t.side)).toEqual(['n', 's', 'w', 'e'])
    for (const t of TILT) {
      expect(t.frame[0]).toBeLessThan(t.frame[1])
      expect(t.frame[1]).toBeLessThanOrEqual(t.raise[0])
      expect(t.raise[0]).toBeLessThan(t.raise[1])
    }
    for (let i = 1; i < TILT.length; i++)
      expect(TILT[i].raise[0]).toBeGreaterThan(TILT[i - 1].raise[1])
    // S is framed while N rises; W and E lie across both, so they wait until both stand.
    expect(beat('s').frame[0]).toBeLessThanOrEqual(beat('n').raise[0])
    expect(beat('s').frame[1]).toBeGreaterThanOrEqual(beat('n').raise[1])
    for (const side of ['w', 'e'])
      expect(beat(side).frame[0]).toBeGreaterThanOrEqual(
        Math.max(beat('n').raise[1], beat('s').raise[1]),
      )
  })

  it('never span a keyframe', () => {
    for (const w of [...Object.values(PHASES), ...TILT.flatMap((t) => [t.frame, t.raise])])
      expect(containsKeyframe(w), `${w}`).toBe(false)
  })
})

describe('retiring the sheet', () => {
  it('dissolves every element kind but walls, once, before the sheet is hidden', () => {
    const covered = DISSOLVE.flatMap((d) => d.kinds)
    expect(new Set(covered).size).toBe(covered.length)
    expect([...covered].sort()).toEqual(KINDS.filter((k) => k !== 'wall').sort())
    for (const d of DISSOLVE) {
      expect(d.win[0]).toBeLessThan(d.win[1])
      expect(d.win[1]).toBeLessThanOrEqual(SHEET_GONE)
      // Everything but the setout string lines has gone before the plates finish turning to wood.
      if (!d.kinds.includes('setout')) expect(d.win[1]).toBeLessThanOrEqual(PHASES.morph[1])
    }
    const drawn = new Set(planDrawing(resolveHouse(HOUSE_NO_1)).elements.map((e) => e.kind))
    for (const k of drawn) expect(KINDS).toContain(k)
    expect(GRID_FADE[1]).toBeLessThanOrEqual(SHEET_GONE)
  })

  it('fades the paper-space frame over PAPER_SPACE, or steps at QUIET under reduced motion', () => {
    const c = chapterIndex('construction')
    expect(paperSpace(0, false)).toBe(1)
    expect(paperSpace(c - 0.5, false)).toBe(1)
    expect(paperSpace(c + PAPER_SPACE[0], false)).toBe(1)
    expect(paperSpace(c + PAPER_SPACE[1], false)).toBe(0)
    expect(paperSpace(c + 3, false)).toBe(0)
    let last = 1
    for (let s = c; s <= c + 0.05; s += 0.001) {
      const v = paperSpace(s, false)
      expect(v).toBeLessThanOrEqual(last)
      last = v
    }
    expect(paperSpace(c + QUIET - 1e-6, true)).toBe(1)
    expect(paperSpace(c + QUIET, true)).toBe(0)
    expect(paperSpace(c - 0.2, true)).toBe(1)
  })

  it('brings the ground shadow in with the swing', () => {
    expect(groundAt(PHASES.swing[0])).toBe(0)
    expect(groundAt(0)).toBe(0)
    expect(groundAt(PHASES.swing[1])).toBe(1)
    expect(groundAt(1)).toBe(1)
    expect(groundAt((PHASES.swing[0] + PHASES.swing[1]) / 2)).toBeCloseTo(0.5, 12)
  })
})

describe('camera', () => {
  it('starts on chapter 1’s last key and ends on the hero shot at p = 1', () => {
    const last = DRAFT_CAMERA.at(-1)!
    expect(CAMERA[0]).toEqual({ p: 0, shot: last.shot, dolly: last.dolly })
    expect(CAMERA.at(-1)!.p).toBe(1)
    expect(CAMERA.at(-1)!.shot).toBe('hero')
    for (let i = 1; i < CAMERA.length; i++) expect(CAMERA[i].p).toBeGreaterThan(CAMERA[i - 1].p)
    for (const k of CAMERA) if (k.shot !== 'plan') expect(SHOTS[k.shot]).toBeDefined()
    // The swing: plan held through the top-down floor beat, then out to the deck view.
    expect(CAMERA.find((k) => k.p === PHASES.swing[0])?.shot).toBe('plan')
    expect(CAMERA.find((k) => k.p === PHASES.swing[1])?.shot).toBe('deck')
  })

  it('views from the south-south-east, looking down', () => {
    for (const [id, s] of Object.entries(SHOTS)) {
      expect(s.box).toBe(id)
      expect(s.pitch).toBeLessThan(0)
      expect(s.pitch).toBeGreaterThan(-Math.PI / 2)
      expect(s.yaw).toBeGreaterThan(0)
      expect(s.yaw).toBeLessThan(Math.PI / 4)
      for (const pad of s.pad) expect(pad).toBeGreaterThanOrEqual(1)
    }
    const [x, y] = wallsForward()
    expect(Math.hypot(x, y)).toBeCloseTo(1, 12)
    expect(x).toBeCloseTo(-0.616, 3)
    expect(y).toBeCloseTo(0.788, 3)
  })
})
