'use client'
import { errorPage } from '@/content/pages/not-found'
import { site } from '@/content/site'

/** The root layout itself threw: a bare page with its own <html> (owner: kit lane). */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en-US">
      <body>
        <main id="main">
          <h1>{errorPage.h1}</h1>
          <p>{errorPage.body}</p>
          <p>
            <button type="button" onClick={() => reset()}>
              {errorPage.retry}
            </button>
          </p>
          <ul>
            {site.nav.map((it) => (
              <li key={it.page}>
                {/* A plain link: the router may be what broke. */}
                <a href={it.href}>{it.label}</a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  )
}
