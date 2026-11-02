/**
 * Chapter 02 — Construction. The signed plan becomes a framed house, scrubbed by scroll: the sheet
 * dissolves, the poché turns into bottom plates, the floor frame slides in under them, the camera
 * swings out to a 3/4 view, the stem walls pour, the deck goes down, each exterior wall is framed
 * flat and raised, then the interior walls, trusses and porch arrive. Pacing lives in
 * lib/framing/script.ts and every member's pose in lib/framing/schedule.ts; this file only maps
 * progress onto the lumber, the retiring sheet and the camera.
 */
import { smoothstep } from '@/lib/framing/flight'
import { corners } from '@/lib/framing/geom3'
import { SUN_DIR } from '@/lib/framing/look'
import { elementWindows, planFraming } from '@/lib/framing/schedule'
import { CAMERA, GRID_FADE, groundAt, quantize, SHEET_GONE, SHOTS } from '@/lib/framing/script'
import { boxCorners, onGround } from '@/lib/framing/shadow'
import type { Vec3 } from '@/lib/framing/types'
import { buildLumber } from '@/scene/build/lumber'
import { extremePoints, fitPoints, type Layout, type Pose } from '@/scene/camera'
import type { ChapterStage, Sheet, StageContext } from '@/scene/chapters/types'

export function construction(ctx: StageContext, sheet: Sheet): ChapterStage {
  const { frame, plan } = ctx
  const { schedule, plan: framing } = planFraming(frame, ctx.house)
  const layer = buildLumber(ctx.renderer, frame, framing.order)
  ctx.root.add(layer.group)
  const ready = layer.warm(ctx.camera, ctx.scene)

  // Each shot holds its members and their flight starts (the schedule's box for it), and the shadow
  // that what stands casts on the ground. Members in flight cast only faint, sparse shadows, so those
  // may leave the frame. The finished house is framed by its outline: its box would keep the air
  // above the eaves in frame.
  const grade = frame.datums.grade
  const outlineOf = (keep: (i: number) => boolean) =>
    extremePoints(frame.members.flatMap((m, i) => (keep(i) ? corners(m) : [])))
  const house = outlineOf(() => true)
  const walls = outlineOf((i) => schedule.phase[i] !== 'trusses' && schedule.phase[i] !== 'porch')
  const shots: Record<string, (layout: Layout) => Pose> = {}
  for (const [name, shot] of Object.entries(SHOTS)) {
    const [lo, hi] = schedule.boxes[shot.box]
    const standing = shot.box === 'deck' || shot.box === 'walls' ? walls : house
    const points = [...(shot.box === 'hero' ? house : boxCorners([lo, hi])), ...onGround(standing, SUN_DIR, grade)]
    const centre: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
    shots[name] = (layout) => fitPoints(points, shot.pitch, shot.yaw, layout, shot.pad[layout.wide ? 0 : 1], centre)
  }

  const windows = elementWindows(plan, schedule)
  const fadeAt = (el: number, p: number): number => 1 - smoothstep(windows[el * 2], windows[el * 2 + 1], p)

  // The pose is a pure function of p, but ~1k matrices are worth skipping when nothing moved.
  let posed = NaN
  let dirty = true

  return {
    id: 'construction',
    camera: CAMERA,
    shots,
    ready,
    quantize,

    resize(layout: Layout) {
      layer.resize(layout)
      dirty = true
    },

    update(p: number) {
      // Retire the sheet: chapter 1's linework and fills by element, its grid and its labels.
      for (let el = 0; el < plan.elements.length; el++) ctx.fade.set(el, fadeAt(el, p))
      sheet.grid.fade = 1 - smoothstep(GRID_FADE[0], GRID_FADE[1], p)
      for (const item of sheet.labels) item.text.fillOpacity = fadeAt(item.label.el, p)
      sheet.group.visible = p < SHEET_GONE

      layer.setGround(groundAt(p))
      const key = Math.min(Math.max(p, framing.firstAt), framing.settledAt)
      if (key !== posed || dirty) {
        layer.commit(framing.pose(key, layer.out))
        posed = key
        dirty = false
      }
    },

    dispose() {
      layer.dispose()
    },

    debug: { schedule, framing, layer, windows },
  }
}
