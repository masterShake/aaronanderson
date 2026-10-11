'use client'
import { useEffect } from 'react'
import { KEY_DIR, nearest } from './nearest'

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
 */

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
}

const CLOSE_DELAY = 250

export function SchematicController({
  figure,
  prefix,
  tools,
  touch,
  chips,
  initial,
}: SchematicControllerProps) {
  useEffect(() => {
    const fig = document.getElementById(figure)
    const callout = document.getElementById(`${prefix}-callout`)
    if (!fig || !callout) return
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

    const setState = (v: string) => {
      state = v
      fig.dataset.toggle = v
      fig.dataset.rev = v
      if (chip && chips[v]) chip.textContent = chips[v]
      for (const s of states) s.setAttribute('aria-pressed', String(s.dataset.stateValue === v))
      for (const b of buttons) b.setAttribute('aria-describedby', `${prefix}-d-${idOf(b)}-${v}`)
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

    for (const s of states) on(s, 'click', () => setState(s.dataset.stateValue ?? initial))

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
    else render()
    return () => {
      cancelClose()
      offs.forEach((off) => off())
    }
  }, [figure, prefix, tools, touch, chips, initial])

  return null
}
