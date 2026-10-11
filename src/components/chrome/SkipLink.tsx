import { site } from '@/content/site'

/** The first focusable element on every page; jumps to <main id="main">. */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      {site.skipLink}
    </a>
  )
}
