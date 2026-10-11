import { test, expect } from '@playwright/test'
import { planFrame } from '@/drawings/lib/frame'
import { modelBounds } from '@/drawings/render/iso'
import { s02Model } from '@/drawings/views/s02'
import { planLines, modelCorners } from '../plan'

/**
 * The plumbing kit draws the hand-off frame without the drawing library; it must be
 * planFrame() exactly (K8: both renderers draw the same frame), and its corners must be
 * modelBounds(), so the rig's iso end pose frames the model as the iso print does.
 */

for (const family of ['wide', 'tall'] as const) {
  test(`planLines equals planFrame's lines (s02 ${family})`, () => {
    const spec = s02Model(family)
    const want = planFrame(spec).lines.map((l) => ({
      id: l.id,
      pts: l.pts.map((p) => [...p]),
      closed: l.closed,
      pen: l.pen,
      ink: l.ink,
      opacity: l.opacity,
      r: l.r,
    }))
    const got = planLines(spec).map((l) => ({ ...l, pts: l.pts.map((p) => [...p]), r: l.r }))
    expect(got).toEqual(want)
  })

  test(`modelCorners equals modelBounds (s02 ${family})`, () => {
    const spec = s02Model(family)
    const got = modelCorners(spec).map((v) => [v.x, v.y, v.z])
    expect(got).toEqual(modelBounds(spec).map((v) => [...v]))
  })
}
