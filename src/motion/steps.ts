import { GATE } from './timing/global'

/**
 * Step states (D8): sets the figure's data-rev when a step heading crosses
 * `line` (55% of the viewport by default). The active step is the last heading
 * whose top is above the line; scrolling fast past several sets the last once.
 * Each heading carries its revision in data-rev-value.
 */
export function watchSteps(o: {
  figure: HTMLElement
  steps: readonly HTMLElement[]
  line?: number
  onChange?: (rev: string, i: number) => void
}): () => void {
  const line = o.line ?? GATE.stepLine
  let raf = 0
  let current = -2
  const tick = () => {
    raf = 0
    const y = innerHeight * line
    let i = -1
    o.steps.forEach((s, n) => {
      if (s.getBoundingClientRect().top < y) i = n
    })
    if (i === current) return
    current = i
    const rev = i >= 0 ? (o.steps[i]?.dataset.revValue ?? '') : (o.steps[0]?.dataset.revValue ?? '')
    if (rev) o.figure.dataset.rev = rev
    o.onChange?.(rev, i)
  }
  const on = () => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  let live = false
  const io = new IntersectionObserver(([e]) => {
    const v = !!e?.isIntersecting
    if (v === live) return
    live = v
    if (v) {
      addEventListener('scroll', on, { passive: true })
      addEventListener('resize', on)
      on()
    } else {
      removeEventListener('scroll', on)
      removeEventListener('resize', on)
    }
  })
  const container = o.steps[0]?.parentElement
  if (container) io.observe(container)
  on()
  return () => {
    io.disconnect()
    removeEventListener('scroll', on)
    removeEventListener('resize', on)
    cancelAnimationFrame(raf)
  }
}
