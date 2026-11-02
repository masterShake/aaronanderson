/**
 * Paper space: screen-aligned HTML over the canvas for things with no place in the model —
 * AI callout chips (with a leader to their anchor) and the pen head with its coordinate readout.
 * Everything here is aria-hidden; the copy column carries the same information as real text.
 * DOM writes happen only when a value changes.
 */
import { Vector3, type PerspectiveCamera } from 'three'
import type { Vec2 } from '@/lib/geom/rect'
import type { Layout } from '@/scene/camera'
import { planToWorld } from '@/scene/coords'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CHECK = '<svg class="ae-check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4 5 8.8 9.6 3.6"/></svg>'
const GAP = 16
const EDGE = 8

export interface ChipState {
  visible: boolean
  text: string
  check: boolean
  /** 0 → 1 entrance (opacity and an 8 px rise). */
  k: number
}

interface Chip {
  id: string
  anchor: Vec2
  offset: Vec2
  dir: 'n' | 's' | 'e' | 'w'
  el: HTMLDivElement
  body: HTMLSpanElement
  leader: SVGLineElement
  dot: SVGCircleElement
  state: ChipState
  size: [number, number]
  dirty: boolean
}

export interface Overlay {
  addChip(id: string, anchor: Vec2, dir: Chip['dir']): void
  setChip(id: string, state: ChipState): void
  setChipOffset(id: string, offset: Vec2): void
  setPen(state: { at: Vec2; down: boolean; readout: string } | null, extra: readonly Vec2[]): void
  layout(camera: PerspectiveCamera, layout: Layout, canvasOffset: Vec2): void
  dispose(): void
}

export function createOverlay(host: HTMLElement): Overlay {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'ae-leaders')
  host.appendChild(svg)
  const pen = document.createElement('div')
  pen.className = 'ae-pen'
  pen.innerHTML = '<span class="ae-pen-cross"></span><span class="ae-pen-dot"></span><span class="ae-pen-readout"></span>'
  pen.hidden = true
  host.appendChild(pen)
  const readout = pen.querySelector<HTMLSpanElement>('.ae-pen-readout')
  const extras: HTMLSpanElement[] = []

  const chips = new Map<string, Chip>()
  let penState: { at: Vec2; down: boolean; readout: string } | null = null
  let extraPts: readonly Vec2[] = []
  let lastReadout = ''
  const v = new Vector3()

  const project = (p: Vec2, camera: PerspectiveCamera, L: Layout, off: Vec2): Vec2 => {
    planToWorld(p[0], p[1], 0, v).project(camera)
    return [off[0] + ((v.x + 1) / 2) * L.W, off[1] + ((1 - v.y) / 2) * L.H]
  }

  return {
    addChip(id, anchor, dir) {
      const el = document.createElement('div')
      el.className = 'ae-chip'
      el.hidden = true
      const body = document.createElement('span')
      body.className = 'ae-chip-body micro'
      el.appendChild(body)
      host.appendChild(el)
      const leader = document.createElementNS(SVG_NS, 'line')
      const dot = document.createElementNS(SVG_NS, 'circle')
      dot.setAttribute('r', '2')
      svg.append(leader, dot)
      chips.set(id, {
        id,
        anchor,
        offset: [0, 0],
        dir,
        el,
        body,
        leader,
        dot,
        state: { visible: false, text: '', check: false, k: 0 },
        size: [0, 0],
        dirty: true,
      })
    },

    setChip(id, state) {
      const c = chips.get(id)
      if (!c) return
      const s = c.state
      if (state.text !== s.text || state.check !== s.check) {
        c.body.innerHTML = `${escapeHtml(state.text)}${state.check ? CHECK : ''}`
        c.dirty = true
      }
      c.state = state
    },

    setChipOffset(id, offset) {
      const c = chips.get(id)
      if (c) c.offset = offset
    },

    setPen(state, extra) {
      penState = state
      extraPts = extra
    },

    layout(camera, L, off) {
      const fx0 = off[0] + L.frame.x
      const fy0 = off[1] + L.frame.y
      const fx1 = fx0 + L.frame.w
      const fy1 = fy0 + L.frame.h
      for (const c of chips.values()) {
        const vis = c.state.visible
        if (c.el.hidden === vis) c.el.hidden = !vis
        c.leader.style.display = vis ? '' : 'none'
        c.dot.style.display = vis ? '' : 'none'
        if (!vis) continue
        if (c.dirty) {
          c.size = [c.body.offsetWidth, c.body.offsetHeight]
          c.dirty = false
        }
        const [ax, ay] = project([c.anchor[0] + c.offset[0], c.anchor[1] + c.offset[1]], camera, L, off)
        const [w, h] = c.size
        let x = c.dir === 'e' ? ax + GAP : c.dir === 'w' ? ax - GAP - w : ax - w / 2
        let y = c.dir === 's' ? ay + GAP : c.dir === 'n' ? ay - GAP - h : ay - h / 2
        x = Math.min(Math.max(x, fx0 + EDGE), fx1 - EDGE - w)
        y = Math.min(Math.max(y, fy0 + EDGE), fy1 - EDGE - h)
        const rise = (1 - c.state.k) * 8
        c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + rise).toFixed(1)}px, 0)`
        c.el.style.opacity = c.state.k.toFixed(3)
        // Leader from the anchor to the nearest point on the chip.
        const lx = Math.min(Math.max(ax, x), x + w)
        const ly = Math.min(Math.max(ay, y + rise), y + rise + h)
        c.leader.setAttribute('x1', ax.toFixed(1))
        c.leader.setAttribute('y1', ay.toFixed(1))
        c.leader.setAttribute('x2', lx.toFixed(1))
        c.leader.setAttribute('y2', ly.toFixed(1))
        c.leader.style.opacity = c.state.k.toFixed(3)
        c.dot.setAttribute('cx', ax.toFixed(1))
        c.dot.setAttribute('cy', ay.toFixed(1))
        c.dot.style.opacity = c.state.k.toFixed(3)
      }

      if (!penState) {
        if (!pen.hidden) pen.hidden = true
      } else {
        if (pen.hidden) pen.hidden = false
        const [px, py] = project(penState.at, camera, L, off)
        pen.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
        pen.dataset.down = penState.down ? 'true' : 'false'
        pen.dataset.flip = px > fx1 - 150 ? 'true' : 'false'
        if (readout && penState.readout !== lastReadout) {
          readout.textContent = penState.readout
          readout.hidden = !penState.readout
          lastReadout = penState.readout
        }
      }
      while (extras.length < extraPts.length) {
        const d = document.createElement('span')
        d.className = 'ae-pen-extra'
        host.appendChild(d)
        extras.push(d)
      }
      extras.forEach((d, i) => {
        const p = extraPts[i]
        d.hidden = !p
        if (p) {
          const [x, y] = project(p, camera, L, off)
          d.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        }
      })
    },

    dispose() {
      svg.remove()
      pen.remove()
      for (const c of chips.values()) c.el.remove()
      for (const d of extras) d.remove()
      chips.clear()
    },
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
