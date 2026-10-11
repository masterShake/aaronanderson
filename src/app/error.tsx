'use client'
import Link from 'next/link'
import { errorPage } from '@/content/pages/not-found'
import { site } from '@/content/site'

/** A route that threw: retry, or go to another sheet (owner: kit lane). */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="wrap" aria-labelledby="error-title">
      <h1 id="error-title">{errorPage.h1}</h1>
      <p>{errorPage.body}</p>
      <p>
        <button type="button" onClick={() => reset()}>
          {errorPage.retry}
        </button>
      </p>
      <h2>{errorPage.links}</h2>
      <ul>
        {site.nav.map((it) => (
          <li key={it.page}>
            <Link href={it.href}>{it.label}</Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href={site.cta.href}>{site.cta.book}</Link>
      </p>
    </section>
  )
}
