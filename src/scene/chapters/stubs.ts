/**
 * Chapters 03–05 are stubs this round: their copy scrolls while the framed house from chapter 2
 * holds on screen. Each one documents the scope it will own. Build them against StageContext —
 * the house is `ctx.house` (resolved HouseSpec, plan inches), every framing member is in
 * `ctx.frame`, and geometry goes under `ctx.root`.
 */
import type { ChapterId } from '@/lib/story/chapters'
import type { ChapterStage } from '@/scene/chapters/types'

/**
 * 03 Trades — roofing, electrical and plumbing (for the trades).
 * Sheathing and roofing over the trusses (main gable 6:12, porch shed 3:12); panel, circuits and
 * boxes; supply and DWV on the 2x6 wet wall shared by both baths and the laundry.
 *
 * 04 Contractors — the kitchen (for contractors).
 * Camera pushes into the kitchen; cabinets, counters, island, appliances and finishes arrive
 * from the fixture rects (kitchen.*) as the kitchen is contracted and finished.
 *
 * 05 Agents — the finished house (for real estate agents).
 * Camera pulls back out; siding, windows, trim, porch, a little landscaping and a for-sale sign
 * in the front yard (south). The house is done.
 */
export function stub(id: ChapterId): ChapterStage {
  return {
    id,
    camera: [],
    shots: {},
    ready: Promise.resolve(),
    resize() {},
    update() {},
    dispose() {},
  }
}
