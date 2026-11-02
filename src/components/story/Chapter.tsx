import type { CSSProperties } from 'react'
import type { ChapterCopy } from '@/content/copy'
import styles from './Chapter.module.css'

interface ChapterProps {
  id: string
  n: string
  audience: string
  /** Chapter height in units of 100lvh. */
  track: number
  copy: ChapterCopy
  /** Intro + three capability blocks, as [start, end] in chapter progress. */
  spans: readonly (readonly [number, number])[]
  /** Chapter 1's CAD layer list, with windows in the drafting block's own progress. */
  layers?: { name: string; s: number; e: number }[]
  /** Screen-reader description of what the stage shows. */
  summary?: string
  /** Open space before the intro, so the previous chapter's last frame can breathe. */
  gapBefore?: boolean
}

const vars = (v: Record<string, number>) => v as CSSProperties

/**
 * One story chapter: real, server-rendered copy in four blocks. Each block is as tall as its
 * span of the chapter; the card inside it is sticky, so it holds while that part of the
 * animation plays and then scrolls away natively. The story store writes --beat (0 → 1) and
 * data-active on each block.
 */
export function Chapter({ id, n, audience, track, copy, spans, layers, summary, gapBefore }: ChapterProps) {
  const block = (span: readonly [number, number]) => ({
    'data-block': '',
    'data-span': `${span[0]} ${span[1]}`,
    style: vars({ '--span': span[1] - span[0] }),
  })
  return (
    <section id={id} data-chapter={id} aria-labelledby={`${id}-title`} className={styles.chapter} style={vars({ '--track': track })}>
      <div className={gapBefore ? `${styles.block} ${styles.gap}` : styles.block} {...block(spans[0])}>
        <div className={`${styles.card} ${styles.intro}`} data-card>
          <p className={`eyebrow ${styles.eyebrow}`}>
            {n} — {audience}
          </p>
          <h2 id={`${id}-title`}>{copy.title}</h2>
          <p className="lead">{copy.lead}</p>
        </div>
      </div>
      <ol className={styles.caps}>
        {copy.caps.map((cap, k) => (
          <li key={cap.title} className={styles.block} {...block(spans[k + 1])}>
            <div className={`${styles.card} ${styles.cap}`} data-card>
              <p className={`micro ${styles.num}`}>
                {n}.{k + 1}
              </p>
              <h3>{cap.title}</h3>
              <p className={styles.line}>{cap.line}</p>
              <span className={styles.beat} aria-hidden="true" />
              {k === 1 && layers ? (
                <ul className={styles.layers} aria-hidden="true">
                  {layers.map((l) => (
                    <li key={l.name} style={vars({ '--s': l.s, '--e': l.e })}>
                      <span className={styles.mark}>
                        <i className={styles.ring} />
                        <i className={styles.dot} />
                        <svg className={styles.tick} viewBox="0 0 10 10">
                          <path d="M2 5.3 4.2 7.4 8.2 2.9" />
                        </svg>
                      </span>
                      {l.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              {k === 2 && copy.closing ? <p className={styles.closing}>{copy.closing}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {summary ? <p className="sr-only">{summary}</p> : null}
    </section>
  )
}
