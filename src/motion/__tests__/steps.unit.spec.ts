import { test, expect } from '@playwright/test'
import { commonAncestor, watchSteps } from '@/motion/steps'

/**
 * Step tracking without a browser: a tiny fake DOM (parentElement, contains,
 * getBoundingClientRect, dataset) and stubbed IntersectionObserver, rAF and
 * window listeners. How It Works puts each step in its own section, so the
 * watcher must observe the element that holds every step, not the first
 * step's parent.
 */

class El {
  readonly dataset: Record<string, string> = {}
  top = 0
  constructor(readonly parentElement: El | null = null) {}
  contains(o: El | null): boolean {
    for (let n = o; n; n = n.parentElement) if (n === this) return true
    return false
  }
  getBoundingClientRect() {
    return { top: this.top }
  }
}

const asEl = (e: El) => e as unknown as HTMLElement

/** main > section × 5 > h2[data-rev-value], plus the figure. */
function page() {
  const main = new El()
  const figure = new El(main)
  const revs = ['existing', 'review', 'construction', 'asBuilt', 'inService']
  const sections = revs.map(() => new El(main))
  const steps = sections.map((s, i) => {
    const h = new El(s)
    h.dataset.revValue = revs[i]!
    return h
  })
  return { main, figure, sections, steps }
}

test('commonAncestor: siblings share their parent; separate sections share main', () => {
  const { main, sections, steps } = page()
  expect(commonAncestor(steps.map(asEl) as never)).toBe(main)
  expect(commonAncestor([asEl(steps[2]!)] as never)).toBe(sections[2])
  const a = new El(sections[0])
  const b = new El(sections[0])
  expect(commonAncestor([asEl(a), asEl(b)] as never)).toBe(sections[0])
  expect(commonAncestor([])).toBeNull()
})

test('watchSteps keeps data-rev updating after the first step’s section has scrolled away', () => {
  const g = globalThis as unknown as Record<string, unknown>
  const saved = Object.fromEntries(
    [
      'IntersectionObserver',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'addEventListener',
      'removeEventListener',
      'innerHeight',
    ].map((k) => [k, g[k]]),
  )
  const observed: unknown[] = []
  let ioCb: ((es: { isIntersecting: boolean; target: unknown }[]) => void) | null = null
  const listeners = new Map<string, () => void>()
  let frames: (() => void)[] = []
  try {
    g.innerHeight = 1000
    g.IntersectionObserver = class {
      constructor(cb: typeof ioCb) {
        ioCb = cb
      }
      observe(el: unknown) {
        observed.push(el)
      }
      disconnect() {}
    }
    g.requestAnimationFrame = (f: () => void) => {
      frames.push(f)
      return frames.length
    }
    g.cancelAnimationFrame = () => {}
    g.addEventListener = (t: string, f: () => void) => listeners.set(t, f)
    g.removeEventListener = (t: string) => listeners.delete(t)
    const flush = () => {
      const fs = frames
      frames = []
      fs.forEach((f) => f())
    }

    const { main, figure, steps } = page()
    // section i starts at 900 × i: step 0 is above the 55% line, the rest below
    const scrollTo = (y: number) => steps.forEach((s, i) => (s.top = 400 + 900 * i - y))
    scrollTo(0)
    const off = watchSteps({ figure: asEl(figure), steps: steps.map(asEl) })
    flush()
    expect(observed).toEqual([main])
    expect(figure.dataset.rev).toBe('existing')

    ioCb!([{ isIntersecting: true, target: main }])
    flush()
    expect(listeners.has('scroll')).toBe(true)

    // far down the page: the first step's section is long gone, the steps container is not
    for (const [y, rev] of [
      [1800, 'construction'],
      [3600, 'inService'],
      [900, 'review'],
    ] as const) {
      scrollTo(y)
      listeners.get('scroll')!()
      flush()
      expect(figure.dataset.rev).toBe(rev)
    }
    off()
    expect(listeners.has('scroll')).toBe(false)
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete g[k]
      else g[k] = v
    }
  }
})
