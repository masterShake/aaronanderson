/**
 * The story store: native scroll → story time s ∈ [0, chapters]. Section offsets are measured
 * only on resize and after fonts load; each scroll event reads scrollY alone. It also drives the
 * copy (data-active and --beat on each block), nav aria-current and the title strip's sign-off,
 * so the page works the same with or without the 3D stage. No React state is involved.
 */
import { REDUCED_MOTION_QUERY } from '@/client/env'
import { SIGNOFF_AT } from '@/lib/draft/script'
import { paperSpace } from '@/lib/framing/script'
import { CHAPTERS } from '@/lib/story/chapters'
import { chapterProgress, clamp01, parseP, scrollFor, storyTime, type ChapterSpan } from '@/lib/story/math'

export interface StoryStore {
  /** Story time from the current scroll position. */
  readonly s: number
  /** True while a ?p= deep-link jump is still pending. */
  readonly seeking: boolean
  subscribe(fn: () => void): () => void
  measure(): void
  dispose(): void
}

interface Block {
  el: HTMLElement
  span: readonly [number, number]
  beat: string
  active: boolean
}

export function startStory(root: HTMLElement): StoryStore {
  const chapters = [...root.querySelectorAll<HTMLElement>('[data-chapter]')]
  const stage = root.querySelector<HTMLElement>('[data-stage]')
  const strip = root.querySelector<HTMLElement>('[data-strip]')
  const blocks: Block[][] = chapters.map((c) =>
    [...c.querySelectorAll<HTMLElement>('[data-block]')].map((el) => {
      const [a, b] = (el.dataset.span ?? '0 1').split(' ').map(Number)
      return { el, span: [a, b] as const, beat: '', active: false }
    }),
  )
  const nav = [...document.querySelectorAll<HTMLAnchorElement>('a[data-nav]')]
  const listeners = new Set<() => void>()
  let spans: ChapterSpan[] = []
  let s = 0
  let raf = 0
  let seeking = false
  let checked: boolean | null = null
  let current: string | null | undefined
  let paper = ''
  const reducedMQ = matchMedia(REDUCED_MOTION_QUERY)

  function measure() {
    const y = window.scrollY
    const stageH = stage?.getBoundingClientRect().height ?? window.innerHeight
    // Progress is read where the copy cards stick (their CSS `top`), so a block's span plays
    // exactly while its card is in place, whatever the layout.
    const card = root.querySelector<HTMLElement>('[data-card]')
    const line = card ? parseFloat(getComputedStyle(card).top) || 0 : 0
    const storyEnd = (chapters.at(-1)?.getBoundingClientRect().bottom ?? 0) + y - stageH
    spans = chapters.map((c, i) => {
      const r = c.getBoundingClientRect()
      const last = i === chapters.length - 1
      const bs = blocks[i].map((b) => {
        const br = b.el.getBoundingClientRect()
        const start = br.top + y - line
        // The story ends when the last chapter's bottom reaches the bottom of the screen.
        const end = last ? Math.min(br.bottom + y - line, storyEnd) : br.bottom + y - line
        return { start, end: Math.max(end, start + 1), p0: b.span[0], p1: b.span[1] }
      })
      const start = bs[0]?.start ?? r.top + y - line
      const end = bs.at(-1)?.end ?? r.bottom + y - line
      return { start, len: Math.max(1, end - start), blocks: bs }
    })
    update()
  }

  function update() {
    raf = 0
    const next = storyTime(window.scrollY, spans)
    const changed = next !== s
    s = next
    write()
    if (changed) for (const fn of listeners) fn()
  }

  function write() {
    chapters.forEach((_, i) => {
      const p = chapterProgress(s, i)
      const inChapter = Math.min(Math.floor(s), chapters.length - 1) === i
      for (const b of blocks[i]) {
        const beat = clamp01((p - b.span[0]) / (b.span[1] - b.span[0])).toFixed(4)
        if (beat !== b.beat) {
          b.el.style.setProperty('--beat', beat)
          b.beat = beat
        }
        const active = inChapter && p >= b.span[0] && (p < b.span[1] || b.span[1] === 1)
        if (active !== b.active) {
          b.el.toggleAttribute('data-active', active)
          b.active = active
        }
      }
    })
    const inStory = spans.length > 0 && window.scrollY >= spans[0].start && s < CHAPTERS.length - 1e-6
    const id = inStory ? CHAPTERS[Math.min(Math.floor(s), CHAPTERS.length - 1)].id : null
    if (id !== current) {
      for (const a of nav) {
        if (a.dataset.nav === id) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      }
      current = id
    }
    const signed = s >= SIGNOFF_AT
    if (strip && signed !== checked) {
      strip.toggleAttribute('data-checked', signed)
      checked = signed
    }
    // Chapter 2 retires the sheet's frame and title strip (CSS applies it only while the stage is live).
    const next = paperSpace(s, reducedMQ.matches).toFixed(3)
    if (stage && next !== paper) {
      stage.style.setProperty('--paper-space', next)
      paper = next
    }
  }

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  reducedMQ.addEventListener('change', write)
  const ro = new ResizeObserver(() => measure())
  ro.observe(root)
  if (stage) ro.observe(stage)
  measure()
  void document.fonts?.ready.then(measure)

  // ?p=architects:0.4 (or story time ?p=0.4): jump straight to a point in the story.
  const target = parseP(location.search)
  if (target !== null) {
    seeking = true
    history.scrollRestoration = 'manual'
    const jump = () => {
      measure()
      window.scrollTo({ top: scrollFor(target, spans), behavior: 'instant' })
      seeking = false
      update()
      for (const fn of listeners) fn()
    }
    if (document.fonts) void document.fonts.ready.then(jump)
    else jump()
  }

  return {
    get s() {
      return s
    },
    get seeking() {
      return seeking
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    measure,
    dispose() {
      window.removeEventListener('scroll', onScroll)
      reducedMQ.removeEventListener('change', write)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      listeners.clear()
    },
  }
}
