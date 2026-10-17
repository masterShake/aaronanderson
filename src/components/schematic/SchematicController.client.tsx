'use client'
import { useEffect } from 'react'
import { idleStart } from '@/lib/idle'
import { KEY_DIR, nearest } from './nearest'
import { lineBoxes, placeAll, type Box } from './place'

/**
 * The Home schematic's client half (pages-drawings §3.2–3.5). Everything it
 * shows is server-rendered; this wires behaviour onto that markup:
 * - As found / Rewired: aria-pressed, data-toggle and data-rev on the figure,
 *   the REV chip, and each tool's aria-describedby (one description per state).
 * - Tool callouts meeting WCAG 1.4.13: hover or focus opens one; it stays while
 *   the pointer is over the tool or the callout (250 ms grace, 12 px bridge);
 *   Esc dismisses it without moving focus; Enter, Space or a tap pins it.
 * - Roving tabindex: arrows move to the nearest tool, Home and End to the first
 *   and last; Tab leaves the group.
 * - Highlight: data-active on the figure and data-hl on every drawing part the
 *   active tool touches.
 * Narrow screens and touch dock the callout under the figure with a close button.
 *
 * None of it runs at hydration: the server's markup already reads and works as
 * a still. The wiring (and its measuring and placing) waits until the figure
 * nears the viewport, then the next idle moment, so it never lands in the
 * hero's 3D window (W2 handover #3). Pointing at, focusing or pressing inside
 * the figure wires it at once and replays that first hover or focus.
 */

/** How near the viewport the figure comes before it is wired. */
const NEAR = '200px 0px'
/** The longest the wiring waits for an idle moment once the figure is near. */
const IDLE_TIMEOUT = 1000
/** The first touches that wire the figure at once (capture phase, on the figure). */
const INTENT = ['pointerover', 'focusin', 'pointerdown'] as const

export interface SchematicControllerProps {
  /** DOM id of the figure. */
  figure: string
  /** Prefix of the schematic's element ids. */
  prefix: string
  /** Tool ids in reading order (row-major). */
  tools: readonly string[]
  /** Drawing part ids each tool touches, per state. */
  touch: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>
  /** REV chip text per state. */
  chips: Readonly<Record<string, string>>
  /** The state the server rendered. */
  initial: string
  /** viewBox width and height per family. */
  viewBox?: Readonly<Record<Family, readonly [number, number]>>
  /** What labels stay clear of, per family and state: flat [x, y, w, h, …] in viewBox units. */
  obstacles?: SchematicObstacles
  /** Route lines per family and state, as flat polylines in viewBox units (labels avoid crossing them). */
  lines?: SchematicLines
}

type Family = 'wide' | 'tall'
export type SchematicObstacles = Record<Family, Record<string, number[]>>
export type SchematicLines = Record<Family, Record<string, number[][]>>
const SVG_NS = 'http://www.w3.org/2000/svg'

const CLOSE_DELAY = 250
const PAD = 3

export function SchematicController({
  figure,
  prefix,
  tools,
  touch,
  chips,
  initial,
  viewBox,
  obstacles,
  lines,
}: SchematicControllerProps) {
  useEffect(() => {
    const setup = (fig: HTMLElement, trigger?: Event): (() => void) | undefined => {
      const callout = document.getElementById(`${prefix}-callout`)
      if (!callout) return
      const btn = (id: string) =>
        document.getElementById(`${prefix}-tool-${id}`) as HTMLButtonElement | null
      const buttons = tools.map(btn).filter((b): b is HTMLButtonElement => Boolean(b))
      const idOf = (b: Element) => b.getAttribute('data-tool') ?? ''
      const titleEl = callout.querySelector<HTMLElement>('[data-callout-title]')
      const bodyEl = callout.querySelector<HTMLElement>('[data-callout-body]')
      const closeBtn = callout.querySelector<HTMLButtonElement>('[data-callout-close]')
      const states = fig.querySelectorAll<HTMLButtonElement>('[data-state-value]')
      const chip = fig.querySelector<HTMLElement>('[data-rev-chip]')

      let state = fig.dataset.toggle ?? initial
      let pinned: string | null = null
      let hovered: string | null = null
      let focused: string | null = null
      let dismissed: string | null = null
      let closeTimer: ReturnType<typeof setTimeout> | null = null
      let touchMode = false

      const active = () => {
        const a = pinned ?? hovered ?? focused
        return a && a !== dismissed ? a : pinned
      }
      const docked = () => touchMode || !matchMedia('(min-width: 640px)').matches

      const highlight = (id: string | null) => {
        for (const el of fig.querySelectorAll('[data-hl]')) el.removeAttribute('data-hl')
        if (!id) {
          delete fig.dataset.active
          return
        }
        fig.dataset.active = id
        for (const part of touch[state]?.[id] ?? [])
          for (const el of fig.querySelectorAll(`.drawing [data-part="${CSS.escape(part)}"]`))
            el.setAttribute('data-hl', '')
      }

      const place = (b: HTMLElement) => {
        const fr = fig.getBoundingClientRect()
        const br = b.getBoundingClientRect()
        const box = fig.querySelector('.box')?.getBoundingClientRect() ?? fr
        callout.style.left = ''
        callout.style.top = ''
        if (docked()) return
        const cw = callout.offsetWidth
        const ch = callout.offsetHeight
        const gap = 12
        let x = br.right + gap
        let y = br.top
        if (x + cw > box.right) x = br.left - gap - cw
        if (x < box.left) {
          x = Math.min(Math.max(br.left, box.left), box.right - cw)
          y = br.bottom + gap
        }
        y = Math.min(Math.max(y, box.top), Math.max(box.top, box.bottom - ch))
        callout.style.left = `${Math.round(x - fr.left)}px`
        callout.style.top = `${Math.round(y - fr.top)}px`
      }

      const render = () => {
        const id = active()
        for (const b of buttons) b.setAttribute('aria-expanded', String(idOf(b) === pinned))
        highlight(id)
        if (!id) {
          callout.hidden = true
          delete callout.dataset.tool
          return
        }
        const desc = document.getElementById(`${prefix}-d-${id}-${state}`)
        if (titleEl) titleEl.textContent = desc?.querySelector('[data-title]')?.textContent ?? ''
        if (bodyEl) bodyEl.textContent = desc?.querySelector('[data-body]')?.textContent ?? ''
        callout.dataset.tool = id
        callout.dataset.docked = docked() ? 'true' : 'false'
        if (closeBtn) closeBtn.hidden = !docked()
        callout.hidden = false
        const b = btn(id)
        if (b) place(b)
      }

      const cancelClose = () => {
        if (closeTimer) clearTimeout(closeTimer)
        closeTimer = null
      }
      const scheduleClose = () => {
        cancelClose()
        closeTimer = setTimeout(() => {
          hovered = null
          render()
        }, CLOSE_DELAY)
      }

      // labels and detail bubbles, placed again at the real width with measured sizes
      const boxEl = fig.querySelector<HTMLElement>('.box')
      const leaderSvg = fig.querySelector<SVGSVGElement>('.labels > svg[data-leaders]')
      let placements = 0
      const layout = () => {
        if (!boxEl || !viewBox || !obstacles) return
        const bw = boxEl.clientWidth
        const bh = boxEl.clientHeight
        if (!bw || !bh) return
        const fam: Family = fig.clientWidth < Number(fig.dataset.famMin ?? 560) ? 'tall' : 'wide'
        const [vw, vh] = viewBox[fam]
        const sx = bw / vw
        const sy = bh / vh
        const br = boxEl.getBoundingClientRect()
        const obs: Box[] = []
        const o = obstacles[fam]?.[state] ?? []
        for (let i = 0; i + 3 < o.length; i += 4)
          obs.push({ x: o[i]! * sx, y: o[i + 1]! * sy, w: o[i + 2]! * sx, h: o[i + 3]! * sy })
        for (const b of buttons) {
          const r = b.getBoundingClientRect()
          if (r.width) obs.push({ x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height })
        }
        const els = [
          ...fig.querySelectorAll<HTMLElement>('.ui li[data-place]'),
          ...fig.querySelectorAll<HTMLElement>('.labels > [data-place]'),
        ].filter((el) => el.offsetWidth > 0)
        const t = fam === 'tall' ? 2 : 0
        const items = els.map((el) => {
          const at = (el.dataset.at ?? '').split(' ').map(Number)
          const gap = (el.dataset.gap ?? '').split(' ').map(Number)
          const r = el.getBoundingClientRect()
          return {
            ax: (at[t] ?? 0) * sx,
            ay: (at[t + 1] ?? 0) * sy,
            gap: (gap[t / 2] ?? 0) * sx,
            w: Math.ceil(r.width),
            h: Math.ceil(r.height),
          }
        })
        const soft = lineBoxes(
          (lines?.[fam]?.[state] ?? []).map((l) => l.map((v, i) => v * (i % 2 ? sy : sx))),
          2,
        )
        const out = placeAll(
          items,
          obs,
          { x: 0, y: 0, w: bw, h: bh },
          { pad: PAD, step: 6, rings: 40 },
          soft,
        )
        const leaders: string[] = []
        els.forEach((el, i) => {
          const b = out[i]!
          el.style.insetInlineStart = `${Math.round((b.x / bw) * 10000) / 100}%`
          el.style.insetBlockStart = `${Math.round((b.y / bh) * 10000) / 100}%`
          // where it sits along a change's scan (percent): it changes as the edge passes it
          const along = fam === 'tall' ? b.y / bh : b.x / bw
          el.style.setProperty('--sch-at', String(Math.round(along * 10000) / 100))
          // a leader from the anchor to the item's nearest edge, once it sits off its anchor
          const it = items[i]!
          if (el.dataset.place?.startsWith('note-') || el.dataset.leader === 'none') return
          const nx = Math.min(Math.max(it.ax, b.x), b.x + b.w)
          const ny = Math.min(Math.max(it.ay, b.y), b.y + b.h)
          if (Math.hypot(nx - it.ax, ny - it.ay) > it.gap + 10)
            leaders.push(
              `M${it.ax.toFixed(1)} ${it.ay.toFixed(1)}L${nx.toFixed(1)} ${ny.toFixed(1)}`,
            )
        })
        if (leaderSvg) {
          leaderSvg.setAttribute('viewBox', `0 0 ${bw} ${bh}`)
          leaderSvg.replaceChildren()
          if (leaders.length) {
            const path = document.createElementNS(SVG_NS, 'path')
            path.setAttribute('d', leaders.join(''))
            leaderSvg.append(path)
          }
        }
        fig.dataset.placed = `${fam}-${state}-${++placements}`
      }

      const setState = (v: string, press = false) => {
        // a press that changes the state plays the scan (schematic.module.css); load never does
        if (press && v !== state) fig.dataset.switch = ''
        state = v
        fig.dataset.toggle = v
        fig.dataset.rev = v
        if (chip && chips[v]) chip.textContent = chips[v]
        for (const s of states) s.setAttribute('aria-pressed', String(s.dataset.stateValue === v))
        for (const b of buttons) b.setAttribute('aria-describedby', `${prefix}-d-${idOf(b)}-${v}`)
        layout()
        render()
      }

      const roving = (to: HTMLButtonElement) => {
        for (const b of buttons) b.tabIndex = b === to ? 0 : -1
        to.focus()
      }

      const offs: (() => void)[] = []
      const on = <K extends keyof HTMLElementEventMap>(
        el: HTMLElement | Document,
        type: K,
        fn: (e: HTMLElementEventMap[K]) => void,
      ) => {
        el.addEventListener(type, fn as EventListener)
        offs.push(() => el.removeEventListener(type, fn as EventListener))
      }

      for (const s of states) on(s, 'click', () => setState(s.dataset.stateValue ?? initial, true))

      for (const b of buttons) {
        const id = idOf(b)
        on(b, 'pointerenter', (e) => {
          touchMode = e.pointerType === 'touch'
          if (touchMode) return
          cancelClose()
          if (dismissed === id) return
          hovered = id
          render()
        })
        on(b, 'pointerleave', (e) => {
          if (e.pointerType === 'touch') return
          if (dismissed === id) dismissed = null
          scheduleClose()
        })
        on(b, 'pointerdown', (e) => {
          touchMode = e.pointerType === 'touch'
        })
        on(b, 'focus', () => {
          // a tap focuses too; on touch only the pin (the tap itself) opens a callout
          if (touchMode) return
          focused = id
          if (dismissed !== id) dismissed = null
          render()
        })
        on(b, 'blur', () => {
          focused = null
          if (dismissed === id) dismissed = null
          render()
        })
        on(b, 'click', () => {
          pinned = pinned === id ? null : id
          dismissed = null
          render()
        })
        on(b, 'keydown', (e) => {
          touchMode = false
          const dir = KEY_DIR[e.key]
          if (dir) {
            e.preventDefault()
            const r = b.getBoundingClientRect()
            const next = nearest(
              r,
              buttons.filter((x) => x !== b).map((x) => ({ el: x, r: x.getBoundingClientRect() })),
              dir,
            )
            if (next) roving(next.el)
          } else if (e.key === 'Home') {
            e.preventDefault()
            roving(buttons[0]!)
          } else if (e.key === 'End') {
            e.preventDefault()
            roving(buttons[buttons.length - 1]!)
          } else if (e.key === 'Escape') {
            if (pinned) pinned = null
            else dismissed = active()
            e.preventDefault()
            render()
          }
        })
      }
      on(callout, 'pointerenter', () => cancelClose())
      on(callout, 'pointerleave', () => {
        if (!pinned) scheduleClose()
      })
      if (closeBtn)
        on(closeBtn, 'click', () => {
          const id = active()
          pinned = null
          hovered = null
          // focus returns to the tool, but its callout stays closed until focus moves
          if (id) btn(id)?.focus()
          dismissed = id
          render()
        })
      on(document, 'keydown', (e) => {
        if (
          e.key === 'Escape' &&
          active() &&
          !buttons.includes(document.activeElement as HTMLButtonElement)
        ) {
          if (pinned) pinned = null
          else dismissed = active()
          render()
        }
      })
      on(document, 'pointerdown', (e) => {
        const t = e.target as Node
        if (!pinned || callout.contains(t) || buttons.some((b) => b.contains(t))) return
        pinned = null
        render()
      })

      if (fig.dataset.toggle && fig.dataset.toggle !== initial) setState(fig.dataset.toggle)
      else {
        layout()
        render()
      }
      // wired by a focus: that tool's focus event came before the wiring, so replay it (a
      // pointer's enter, down and click all follow the pointerover that wired it)
      const was = document.activeElement
      if (trigger?.type === 'focusin' && !touchMode && buttons.some((b) => b === was)) {
        focused = idOf(was as Element)
        render()
      }
      // the width decides the family and the px per unit; web fonts change label widths
      let lastW = fig.clientWidth
      const ro = new ResizeObserver(() => {
        if (fig.clientWidth === lastW) return
        lastW = fig.clientWidth
        layout()
      })
      ro.observe(fig)
      let live = true
      document.fonts?.ready.then(() => {
        if (live) layout()
      })
      return () => {
        live = false
        ro.disconnect()
        cancelClose()
        offs.forEach((off) => off())
      }
    }

    // wire it once it nears the viewport (then at the next idle moment), or at the first touch
    const host = document.getElementById(figure)
    if (!host) return
    let wired = false
    let stop: (() => void) | undefined
    let cancelIdle: (() => void) | undefined
    let io: IntersectionObserver | null = null
    const unhook = () => {
      io?.disconnect()
      cancelIdle?.()
      for (const t of INTENT) host.removeEventListener(t, start, true)
    }
    function start(e?: Event) {
      if (wired) return
      wired = true
      unhook()
      stop = setup(host!, e)
    }
    for (const t of INTENT) host.addEventListener(t, start, { capture: true, passive: true })
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(
        (entries) => {
          if (cancelIdle || !entries.some((en) => en.isIntersecting)) return
          io?.disconnect()
          cancelIdle = idleStart(() => start(), IDLE_TIMEOUT)
        },
        { rootMargin: NEAR },
      )
      io.observe(host)
    } else start()
    return () => {
      wired = true
      unhook()
      stop?.()
    }
  }, [figure, prefix, tools, touch, chips, initial, viewBox, obstacles, lines])

  return null
}
