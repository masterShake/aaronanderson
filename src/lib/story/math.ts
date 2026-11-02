/**
 * Story time. Chapter i spans [start_i, start_i + len_i) of scrollY, and these spans are
 * contiguous, so story time s = i + p_i runs from 0 to the number of chapters with no dead zones.
 * Chapter 1's p is 0 exactly when the stage pins.
 *
 * Within a chapter, progress is piecewise linear over its copy blocks: each block's measured
 * scroll range maps onto its span of chapter progress. CSS can size blocks however it needs to
 * (taller on phones) and the copy stays in step with the drawing.
 */
import { CHAPTERS, chapterIndex } from '@/lib/story/chapters'

export interface BlockSpan {
  /** Absolute scrollY range of the block. */
  start: number
  end: number
  /** The chapter progress the block covers. */
  p0: number
  p1: number
}

export interface ChapterSpan {
  start: number
  len: number
  blocks?: readonly BlockSpan[]
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

function progressIn(scrollY: number, c: ChapterSpan): number {
  const blocks = c.blocks
  if (!blocks?.length) return clamp01(c.len > 0 ? (scrollY - c.start) / c.len : 1)
  if (scrollY <= blocks[0].start) return blocks[0].p0
  for (const b of blocks) {
    if (scrollY < b.end) {
      const k = b.end > b.start ? clamp01((scrollY - b.start) / (b.end - b.start)) : 1
      return b.p0 + (b.p1 - b.p0) * k
    }
  }
  return blocks[blocks.length - 1].p1
}

export function storyTime(scrollY: number, spans: readonly ChapterSpan[]): number {
  if (!spans.length) return 0
  let i = 0
  while (i + 1 < spans.length && scrollY >= spans[i + 1].start) i++
  return i + progressIn(scrollY, spans[i])
}

/** Inverse of storyTime: the scrollY that shows story time s. */
export function scrollFor(s: number, spans: readonly ChapterSpan[]): number {
  if (!spans.length) return 0
  const i = Math.min(spans.length - 1, Math.max(0, Math.floor(s)))
  const p = clamp01(s - i)
  const c = spans[i]
  const b = c.blocks?.find((x) => p <= x.p1) ?? c.blocks?.[c.blocks.length - 1]
  if (!b) return c.start + p * c.len
  const k = b.p1 > b.p0 ? (p - b.p0) / (b.p1 - b.p0) : 0
  return b.start + clamp01(k) * (b.end - b.start)
}

/** Progress of chapter i at story time s. */
export const chapterProgress = (s: number, i: number): number => clamp01(s - i)

/** Exponential approach, independent of frame rate: cur → tgt with time constant 1/lambda. */
export const damp = (cur: number, tgt: number, dt: number, lambda = 12): number =>
  cur + (tgt - cur) * (1 - Math.exp(-lambda * dt))

/**
 * `?p=0.42` (story time) or `?p=architects:0.42` (chapter progress). Returns story time, or null.
 */
export function parseP(search: string): number | null {
  const raw = new URLSearchParams(search).get('p')
  if (!raw) return null
  const [a, b] = raw.split(':')
  if (b !== undefined) {
    const i = chapterIndex(a)
    const p = Number(b)
    return i >= 0 && Number.isFinite(p) ? i + clamp01(p) : null
  }
  const s = Number(a)
  return Number.isFinite(s) ? Math.min(CHAPTERS.length, Math.max(0, s)) : null
}
