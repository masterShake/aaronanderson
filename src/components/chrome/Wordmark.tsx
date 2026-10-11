import { site } from '@/content/site'
import s from './chrome.module.css'

/**
 * The ACTUAL ENGINEER wordmark, with the isometric junction-box mark: a 20 u
 * cube with a lid line and a short conduit stub. Static (D10: small figures
 * never draw on); decorative, so the mark is aria-hidden.
 */
export function Wordmark({ size, mark }: { size: 'header' | 'footer'; mark?: boolean }) {
  return (
    <span className={s.wordmark} data-size={size}>
      {mark ? (
        <svg className={s.mark} aria-hidden="true" viewBox="0 0 28 28" focusable="false">
          {/* faces: top, left, right */}
          <path className={s.faceTop} d="M14 4 23 9 14 14 5 9Z" />
          <path className={s.faceLeft} d="M5 9 14 14V24L5 19Z" />
          <path className={s.faceRight} d="M14 14 23 9V19L14 24Z" />
          {/* edges, lid line and conduit stub */}
          <path
            className={s.markLine}
            d="M14 4 23 9V19L14 24 5 19V9ZM5 9 14 14 23 9M14 14V24M5 11.5 14 16.5 23 11.5M23 15H27"
          />
        </svg>
      ) : null}
      <span className={s.word}>{site.wordmark}</span>
    </span>
  )
}
