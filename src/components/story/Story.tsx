import { StageMount } from '@/components/stage/StageMount'
import { Chapter } from '@/components/story/Chapter'
import { STORY } from '@/content/copy'
import { BEATS, BLOCKS } from '@/lib/draft/script'
import { BLOCKS as FRAMING_BLOCKS } from '@/lib/framing/script'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { houseSummary, projectLine, sheetDate } from '@/lib/house/summary'
import { CHAPTERS } from '@/lib/story/chapters'
import styles from './Story.module.css'

/** Chapters without a script yet: a longer intro, then the three capabilities. */
const STUB_SPANS = [
  [0, 0.4],
  [0.4, 0.6],
  [0.6, 0.8],
  [0.8, 1],
] as const

/** CAD layers listed in chapter 1's "Drawings, drafted" card, with the beats that draw them. */
const LAYERS: { name: string; beats: string[] }[] = [
  { name: 'A-WALL', beats: ['exterior', 'interior'] },
  { name: 'A-GLAZ · A-DOOR', beats: ['openings'] },
  { name: 'A-FLOR-CASE', beats: ['casework'] },
  { name: 'A-ROOF-OTLN', beats: ['site'] },
  { name: 'A-ANNO-DIMS', beats: ['dims'] },
  { name: 'A-AREA-IDEN', beats: ['labels'] },
]

/** Layer windows expressed in the drafting block's own 0 → 1 progress. */
function layerWindows() {
  const block = BLOCKS.find((b) => b.id === 'drafting')?.span ?? [0, 1]
  const local = (p: number) => (p - block[0]) / (block[1] - block[0])
  return LAYERS.map((l) => {
    const wins = BEATS.filter((b) => l.beats.includes(b.id)).map((b) => b.win)
    return { name: l.name, s: local(Math.min(...wins.map((w) => w[0]))), e: local(Math.max(...wins.map((w) => w[1]))) }
  })
}

export function Story() {
  return (
    <div className={styles.story} data-story>
      <StageMount
        strip={{
          project: projectLine(HOUSE_NO_1),
          drawing: HOUSE_NO_1.meta.drawing,
          scale: HOUSE_NO_1.meta.scale,
          date: sheetDate(HOUSE_NO_1),
          sheet: HOUSE_NO_1.meta.sheet,
        }}
      />
      <div className={styles.chapters}>
        {CHAPTERS.map((c, i) => (
          <Chapter
            key={c.id}
            id={c.id}
            n={c.n}
            audience={c.audience}
            track={c.track}
            copy={STORY[c.id]}
            spans={i === 0 ? BLOCKS.map((b) => b.span) : i === 1 ? FRAMING_BLOCKS.map((b) => b.span) : STUB_SPANS}
            layers={i === 0 ? layerWindows() : undefined}
            summary={i === 0 ? houseSummary(HOUSE_NO_1) : undefined}
            gapBefore={i > 0}
          />
        ))}
      </div>
    </div>
  )
}
