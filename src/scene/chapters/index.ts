import { CHAPTERS } from '@/lib/story/chapters'
import { architects } from '@/scene/chapters/architects'
import { construction } from '@/scene/chapters/construction'
import { stub } from '@/scene/chapters/stubs'
import type { ChapterStage, StageContext } from '@/scene/chapters/types'

/** One stage per chapter, in CHAPTERS order. Replace a stub here when its chapter is built. */
export function createChapters(ctx: StageContext): ChapterStage[] {
  // Chapter 2 retires chapter 1's sheet, so it takes the sheet's handle.
  const a = architects(ctx)
  return CHAPTERS.map((c) =>
    c.id === 'architects' ? a : c.id === 'construction' ? construction(ctx, a.sheet) : stub(c.id),
  )
}
