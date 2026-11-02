/**
 * draftTimeline(plan): when every primitive of the plan drawing appears, as [t0, t1] windows in
 * chapter progress. Strokes in a beat are dealt to pen tracks; each track draws at constant speed
 * (drawn length plus pen-up travel), so corners chain naturally and the pen never jumps.
 */
import { dist, lerp2, type Vec2 } from '@/lib/geom/rect'
import { BEATS, DRAWN_BY, LABEL_TYPE, MARKS, POCHE_LAG, type MarkWindow } from '@/lib/draft/script'
import type { BeatId, PlanDrawing, Stroke } from '@/lib/plan/types'

/** Pen-up travel costs this fraction of the time of drawing the same distance. */
const TRAVEL_WEIGHT = 0.35

export interface PenTrack {
  beat: BeatId
  track: number
  /** Stroke indices in drawing order. */
  strokes: number[]
}

export interface Timeline {
  /** Per stroke: its whole window [t0, t1]. Length 2 × strokes. */
  strokes: Float32Array
  /** Per fill [t0, t1]. */
  fills: Float32Array
  /** Per label [t0, t1]. */
  labels: Float32Array
  marks: readonly MarkWindow[]
  tracks: readonly PenTrack[]
}

export const polylineLength = (pts: readonly Vec2[]): number => {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i])
  return s
}

export function draftTimeline(plan: PlanDrawing): Timeline {
  const strokes = new Float32Array(plan.strokes.length * 2).fill(-1)
  const tracks: PenTrack[] = []

  for (const beat of BEATS) {
    const members = plan.strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.beat === beat.id)
    if (!members.length) continue
    const lanes: number[][] = Array.from({ length: beat.pens }, () => [])
    members.forEach(({ s, i }, k) => lanes[(s.track ?? k) % beat.pens].push(i))
    lanes.forEach((lane, track) => {
      if (!lane.length) return
      tracks.push({ beat: beat.id, track, strokes: lane })
      layOut(plan.strokes, lane, beat.win, strokes)
    })
  }

  // Element windows (over their wall strokes) drive the poché and solid fills.
  const elWin = new Map<number, [number, number]>()
  plan.strokes.forEach((s, i) => {
    const t0 = strokes[i * 2]
    const t1 = strokes[i * 2 + 1]
    if (t0 < 0) return
    const w = elWin.get(s.el)
    elWin.set(s.el, w ? [Math.min(w[0], t0), Math.max(w[1], t1)] : [t0, t1])
  })

  const fills = new Float32Array(plan.fills.length * 2)
  plan.fills.forEach((f, i) => {
    const w = elWin.get(f.el) ?? beatWindow(f.beat)
    let t0: number
    let t1: number
    if (f.kind === 'poche') [t0, t1] = [w[0] + POCHE_LAG, w[1] + POCHE_LAG]
    else if (f.kind === 'wash') [t0, t1] = [w[0], w[1]]
    else [t0, t1] = [w[1], w[1] + 0.01]
    fills[i * 2] = Math.min(t0, DRAWN_BY)
    fills[i * 2 + 1] = Math.min(Math.max(t1, t0 + 1e-3), DRAWN_BY)
  })

  // Labels: dimension text types in as soon as its string's line is drawn; everything else
  // types in sequence across its beat.
  const labels = new Float32Array(plan.labels.length * 2)
  const byBeat = new Map<BeatId, number[]>()
  plan.labels.forEach((l, i) => {
    if (l.beat === 'dims') {
      const w = elWin.get(l.el) ?? beatWindow('dims')
      labels[i * 2] = w[1]
      labels[i * 2 + 1] = w[1] + LABEL_TYPE
    } else byBeat.set(l.beat, [...(byBeat.get(l.beat) ?? []), i])
  })
  for (const [beat, list] of byBeat) {
    const [w0, w1] = beatWindow(beat)
    const step = (w1 - w0 - LABEL_TYPE) / Math.max(1, list.length - 1)
    list.forEach((i, k) => {
      labels[i * 2] = w0 + step * k
      labels[i * 2 + 1] = w0 + step * k + LABEL_TYPE
    })
  }

  return { strokes, fills, labels, marks: MARKS, tracks }
}

function beatWindow(id: BeatId): readonly [number, number] {
  return BEATS.find((b) => b.id === id)?.win ?? [0, DRAWN_BY]
}

/** Give each stroke in a lane its window, at constant speed including pen-up travel. */
function layOut(all: readonly Stroke[], lane: readonly number[], win: readonly [number, number], out: Float32Array) {
  const lens = lane.map((i) => polylineLength(all[i].pts))
  const travel = lane.map((i, k) =>
    k + 1 < lane.length ? dist(last(all[i].pts), all[lane[k + 1]].pts[0]) * TRAVEL_WEIGHT : 0,
  )
  const total = lens.reduce((a, b) => a + b, 0) + travel.reduce((a, b) => a + b, 0)
  const rate = (win[1] - win[0]) / Math.max(total, 1e-9)
  let cursor = win[0]
  lane.forEach((i, k) => {
    out[i * 2] = cursor
    cursor += lens[k] * rate
    out[i * 2 + 1] = cursor
    cursor += travel[k] * rate
  })
}

const last = <T>(xs: readonly T[]): T => xs[xs.length - 1]

/**
 * Per-segment windows for one stroke: its window split in proportion to segment length.
 * Returns pairs [t0, t1] for each of the stroke's pts.length − 1 segments.
 */
export function segmentWindows(pts: readonly Vec2[], t0: number, t1: number): Float32Array {
  const out = new Float32Array((pts.length - 1) * 2)
  const total = polylineLength(pts)
  let acc = 0
  for (let k = 0; k + 1 < pts.length; k++) {
    const len = dist(pts[k], pts[k + 1])
    out[k * 2] = t0 + (t1 - t0) * (total ? acc / total : 0)
    acc += len
    out[k * 2 + 1] = t0 + (t1 - t0) * (total ? acc / total : 1)
  }
  return out
}

export interface PenState {
  at: Vec2
  /** Drawing (pen down) vs travelling between strokes. */
  down: boolean
}

/**
 * Where a pen track's tip is at progress p, or null outside the track's span. Uses the same
 * linear rule as the GPU, so the tip sits exactly on the end of the visible stroke.
 */
export function penAt(plan: PlanDrawing, tl: Timeline, track: PenTrack, p: number): PenState | null {
  const ids = track.strokes
  const first = ids[0]
  const lastId = ids[ids.length - 1]
  if (p < tl.strokes[first * 2] || p > tl.strokes[lastId * 2 + 1]) return null
  // Binary search for the last stroke starting at or before p.
  let lo = 0
  let hi = ids.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (tl.strokes[ids[mid] * 2] <= p) lo = mid
    else hi = mid - 1
  }
  const i = ids[lo]
  const t0 = tl.strokes[i * 2]
  const t1 = tl.strokes[i * 2 + 1]
  const pts = plan.strokes[i].pts
  if (p <= t1) return { at: pointAlong(pts, t1 > t0 ? (p - t0) / (t1 - t0) : 1), down: true }
  const next = ids[lo + 1]
  if (next === undefined) return { at: last(pts), down: false }
  const n0 = tl.strokes[next * 2]
  const k = n0 > t1 ? (p - t1) / (n0 - t1) : 1
  return { at: lerp2(last(pts), plan.strokes[next].pts[0], Math.min(1, Math.max(0, k))), down: false }
}

export function pointAlong(pts: readonly Vec2[], k: number): Vec2 {
  const total = polylineLength(pts)
  let target = total * Math.min(1, Math.max(0, k))
  for (let j = 1; j < pts.length; j++) {
    const len = dist(pts[j - 1], pts[j])
    if (target <= len || j === pts.length - 1) return lerp2(pts[j - 1], pts[j], len ? Math.min(1, target / len) : 1)
    target -= len
  }
  return pts[0]
}
