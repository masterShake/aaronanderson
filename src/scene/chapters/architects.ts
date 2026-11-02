/**
 * Chapter 01 — Architects. An AI pen drafts House No. 1 on the ground plane, scrubbed by scroll:
 * sheet and grid → setout → three test fits (B chosen) → walls, poché, openings, casework,
 * site, dimensions, labels → blue code-check markup → sign-off. Pacing lives in
 * lib/draft/script.ts; this file only maps progress onto the meshes built from the plan.
 */
import { Color, Group } from 'three'
import { BEATS, BLOCKS, blockAt, CAMERA, FADES, SHEET_WINDOW, type DraftBeat } from '@/lib/draft/script'
import { penAt, type PenState, type PenTrack } from '@/lib/draft/timeline'
import type { Vec2 } from '@/lib/geom/rect'
import { PALETTE, PENS, SETTLE } from '@/lib/plan/pens'
import type { FitGroup } from '@/lib/plan/types'
import { clamp01 } from '@/lib/story/math'
import { formatFtIn } from '@/lib/units'
import { fitBox, inOutCubic, type Layout } from '@/scene/camera'
import { buildFills } from '@/scene/build/fills'
import { buildGrid } from '@/scene/build/grid'
import { buildLines } from '@/scene/build/lines'
import { buildLabels, scaleLabels } from '@/scene/build/text'
import type { ChapterStage, Sheet, StageContext } from '@/scene/chapters/types'
import type { DraftUniforms } from '@/scene/materials/DraftLineMaterial'

const AI = new Color(PALETTE.ai)
const GRID_RADIUS = 1700
const PEN_TRAVEL_MAX = 0.03
const CHECKS_FROM = BLOCKS.find((b) => b.id === 'checks')?.span[0] ?? 1

interface Fadeable {
  fade: number
}

export function architects(ctx: StageContext): ChapterStage & { sheet: Sheet } {
  const { plan, timeline: tl, root, overlay } = ctx
  const shared: DraftUniforms = { progress: { value: 0 }, fadeTex: { value: ctx.fade.texture } }

  // Everything the sheet draws lives in one group, so chapter 2 can retire the drawing as a whole.
  const sheet = new Group()
  sheet.name = 'sheet'
  root.add(sheet)
  const grid = buildGrid(plan.box.building)
  sheet.add(grid.mesh)
  const lines = buildLines(plan, tl, shared)
  for (const l of lines) sheet.add(l.mesh)
  const fills = buildFills(plan, tl, shared)
  for (const f of fills) sheet.add(f.mesh)
  const text = buildLabels(plan, tl)
  sheet.add(text.group)
  for (const m of plan.marks) overlay.addChip(m.id, m.at, m.dir)

  // Whole-layer fades from the script, resolved to the materials (and meshes) they act on.
  const fades = FADES.map((f) => {
    const [kind, name] = f.target.split(':')
    const targets: { material: Fadeable; mesh: { visible: boolean } }[] =
      kind === 'group'
        ? lines.filter((l) => l.group === name).map((l) => ({ material: l.material, mesh: l.mesh }))
        : kind === 'pen'
          ? lines.filter((l) => l.pen === name && !l.group).map((l) => ({ material: l.material, mesh: l.mesh }))
          : fills.filter((x) => x.kind === name).map((x) => ({ material: x.material, mesh: x.mesh }))
    return { win: f.win, targets }
  })

  const groupOf = (track: PenTrack): FitGroup | undefined => plan.strokes[track.strokes[0]]?.group
  let offsets = plan.fitOffsets.wide
  let wide = true

  const penReadout = (at: Vec2) => `X ${formatFtIn(Math.round(at[0]), 'inch')} · Y ${formatFtIn(Math.round(at[1]), 'inch')}`

  const withOffset = (track: PenTrack, s: PenState): PenState => {
    const g = groupOf(track)
    if (!g) return s
    const o = offsets[g]
    return { ...s, at: [s.at[0] + o[0], s.at[1] + o[1]] }
  }

  const trackEnd = (beat: DraftBeat, which: 'start' | 'end'): Vec2 | null => {
    const t = tl.tracks.find((x) => x.beat === beat.id && x.track === 0) ?? tl.tracks.find((x) => x.beat === beat.id)
    if (!t) return null
    const i = which === 'start' ? t.strokes[0] : t.strokes[t.strokes.length - 1]
    const pts = plan.strokes[i].pts
    const s = { at: which === 'start' ? pts[0] : pts[pts.length - 1], down: false }
    return withOffset(t, s).at
  }

  function penFor(q: number): { main: PenState | null; extra: Vec2[] } {
    const extra: Vec2[] = []
    const beat = BEATS.find((b) => q >= b.win[0] && q <= b.win[1])
    if (beat) {
      const tracks = tl.tracks.filter((t) => t.beat === beat.id)
      const main = tracks.find((t) => t.track === 0) ?? tracks[0]
      for (const t of tracks) {
        if (t === main) continue
        const s = penAt(plan, tl, t, q)
        if (s?.down) extra.push(withOffset(t, s).at)
      }
      const s = main ? penAt(plan, tl, main, q) : null
      if (s) return { main: withOffset(main, s), extra }
    }
    // Sign-off: the pen travels home to the SW corner, where the first sill plate goes.
    const lastBeat = BEATS[BEATS.length - 1]
    if (q >= 0.93) {
      const from = trackEnd(lastBeat, 'end') ?? [0, 0]
      const k = inOutCubic(clamp01((q - 0.93) / 0.03))
      return { main: q >= 0.999 ? null : { at: [from[0] * (1 - k), from[1] * (1 - k)], down: false }, extra }
    }
    // Between beats: pen-up travel if the gap is short, otherwise hidden.
    const prev = [...BEATS].reverse().find((b) => b.win[1] <= q)
    const next = BEATS.find((b) => b.win[0] >= q)
    if (prev && next && next.win[0] - prev.win[1] <= PEN_TRAVEL_MAX) {
      const a = trackEnd(prev, 'end')
      const b = trackEnd(next, 'start')
      if (a && b) {
        const k = clamp01((q - prev.win[1]) / Math.max(1e-6, next.win[0] - prev.win[1]))
        return { main: { at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], down: false }, extra }
      }
    }
    if (prev && q - prev.win[1] <= PEN_TRAVEL_MAX) {
      const a = trackEnd(prev, 'end')
      if (a) return { main: { at: a, down: false }, extra }
    }
    return { main: null, extra }
  }

  return {
    id: 'architects',
    sheet: { group: sheet, grid: grid.material, labels: text.items },
    camera: CAMERA,
    shots: {
      plan: (layout) => fitBox(plan.box.drawing, layout, 1.04),
      testfits: (layout) => fitBox(layout.wide ? plan.box.testfits.wide : plan.box.testfits.narrow, layout, 1.08),
    },
    ready: text.ready,

    quantize: (p) => BLOCKS[blockAt(p)].keyframe,

    resize(layout: Layout) {
      wide = layout.wide
      offsets = wide ? plan.fitOffsets.wide : plan.fitOffsets.narrow
      for (const l of lines) {
        const w = PENS[l.pen].width[wide ? 0 : 1]
        l.material.linewidth = Math.max(w, 1 / layout.dpr)
        if (l.group) l.mesh.position.set(offsets[l.group][0], offsets[l.group][1], 0)
        if (l.pen === 'tag') l.mesh.visible = wide
      }
      for (const m of plan.marks) if (m.group) overlay.setChipOffset(m.id, offsets[m.group])
      grid.material.dpr = layout.dpr
      scaleLabels(text.items, fitBox(plan.box.drawing, layout, 1.04).pxPerIn, wide)
    },

    update(q: number) {
      shared.progress.value = q
      grid.material.reveal = inOutCubic(clamp01((q - SHEET_WINDOW[0]) / (SHEET_WINDOW[1] - SHEET_WINDOW[0]))) * GRID_RADIUS

      for (const f of fades) {
        const k = 1 - clamp01((q - f.win[0]) / (f.win[1] - f.win[0]))
        for (const t of f.targets) {
          t.material.fade = k
          t.mesh.visible = k > 0
        }
      }

      for (const item of text.items) {
        const k = clamp01((q - item.t0) / Math.max(1e-6, item.t1 - item.t0))
        const show = item.synced && k > 0 && (wide || item.label.lod === 1)
        item.text.visible = show
        if (!show) continue
        const [x0, y0, x1, y1] = item.clip
        item.text.clipRect = k >= 1 ? null : [x0, y0, x0 + (x1 - x0) * k, y1]
        item.color.copy(AI).lerp(item.final, clamp01((q - item.t1) / SETTLE))
        item.text.color = item.color
      }

      // Chips: at most two at a time (one on narrow screens; only B's test-fit chip there).
      const live = tl.marks.filter((m) => q >= m.show[0] && q < m.show[1])
      const keep = new Set((wide ? live.slice(-2) : live.filter((m) => m.id !== 'fit-A' && m.id !== 'fit-C').slice(-1)).map((m) => m.id))
      if (wide) for (const m of live) if (m.id.startsWith('fit-')) keep.add(m.id)
      for (const w of tl.marks) {
        const mark = plan.marks.find((m) => m.id === w.id)
        if (!mark) continue
        const swapped = w.swapAt !== undefined && q >= w.swapAt
        const k = Math.min(clamp01((q - w.show[0]) / 0.012), clamp01((w.show[1] - q) / 0.01))
        overlay.setChip(w.id, {
          visible: keep.has(w.id) && k > 0,
          text: swapped && mark.then ? mark.then : mark.text,
          check: swapped ? Boolean(mark.thenCheck) : Boolean(mark.check),
          k: ctx.flags.reducedMotion ? 1 : k,
        })
      }

      if (ctx.flags.reducedMotion) overlay.setPen(null, [])
      else {
        // During the code checks the chips carry the numbers; the readout would only collide.
        const pen = penFor(q)
        const readout = pen.main && q < CHECKS_FROM ? penReadout(pen.main.at) : ''
        overlay.setPen(pen.main ? { ...pen.main, readout } : null, pen.extra)
      }
    },

    dispose() {
      for (const l of lines) {
        l.mesh.geometry.dispose()
        l.material.dispose()
      }
      for (const f of fills) {
        f.mesh.geometry.dispose()
        f.material.dispose()
      }
      for (const item of text.items) item.text.dispose()
      grid.mesh.geometry.dispose()
      grid.material.dispose()
    },
  }
}
