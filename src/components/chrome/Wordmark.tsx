import { site } from '@/content/site'
import s from './chrome.module.css'

/** The ACTUAL ENGINEER wordmark, with the junction-box mark (static). */
export function Wordmark({ size, mark }: { size: 'header' | 'footer'; mark?: boolean }) {
  return (
    <span className={s.wordmark} data-size={size}>
      {mark ? (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{ display: 'inline', marginInlineEnd: 6 }}
        >
          <path
            d="M9 1 17 5v8l-8 4-8-4V5z M1 5l8 4 8-4 M9 9v8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ) : null}
      {site.wordmark}
    </span>
  )
}
