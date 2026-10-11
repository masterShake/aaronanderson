/**
 * Turns the booking link in src/content/site.ts into what the page and the CSP
 * need. No imports: next.config.ts loads this file to build the static CSP.
 */

export interface CspSources {
  script: string[]
  frame: string[]
  font: string[]
  img: string[]
  connect: string[]
}

type Base = { bookingUrl: string; preconnect: string[]; csp: CspSources }

export type Scheduler =
  | (Base & {
      provider: 'cal'
      providerName: 'Cal.com'
      calLink: string
      namespace: string
      calOrigin: string
      embedJsUrl: string
    })
  | (Base & { provider: 'calendly'; providerName: 'Calendly'; iframeSrc: string })
  | (Base & { provider: 'link'; providerName: string })

const none = (): CspSources => ({ script: [], frame: [], font: [], img: [], connect: [] })

/** A Cal.com, Calendly or plain link, or null while the link is still a HOLD. */
export function resolveScheduler(
  raw: string | null | undefined,
  siteHost: string,
): Scheduler | null {
  // Never render <Cal> with an empty calLink: it throws.
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  const path = u.pathname.replace(/^\/+|\/+$/g, '')
  if (host === 'calendly.com') {
    const src = new URL(u.href)
    src.searchParams.set('embed_type', 'Inline')
    src.searchParams.set('embed_domain', siteHost)
    return {
      provider: 'calendly',
      providerName: 'Calendly',
      bookingUrl: u.href,
      iframeSrc: src.href,
      preconnect: ['https://calendly.com'],
      csp: { ...none(), frame: ['https://calendly.com'], img: ['https://assets.calendly.com'] },
    }
  }
  const app = ['cal.com', 'app.cal.com'].includes(host)
    ? 'https://app.cal.com'
    : ['cal.eu', 'app.cal.eu'].includes(host)
      ? 'https://app.cal.eu'
      : null
  if (app) {
    return {
      provider: 'cal',
      providerName: 'Cal.com',
      bookingUrl: u.href,
      calLink: path,
      namespace: path.split('/').pop() ?? 'book',
      calOrigin: app,
      embedJsUrl: `${app}/embed/embed.js`,
      preconnect: [app],
      csp: { ...none(), script: [app], frame: [app], font: ['https://cal.com'] },
    }
  }
  return { provider: 'link', providerName: host, bookingUrl: u.href, preconnect: [], csp: none() }
}
