import type { Route } from 'next'
import type { PageKey, ServiceId } from '@/content/types'

/** The five sheets in reading order, and the links that point between them. */
export const PATH = {
  home: '/',
  services: '/services',
  'how-it-works': '/how-it-works',
  about: '/about',
  contact: '/contact',
} as const satisfies Record<PageKey, Route>

export const SHEET_ORDER: readonly PageKey[] = [
  'home',
  'services',
  'how-it-works',
  'about',
  'contact',
]

export const BOOK_HREF = '/contact#book' satisfies Route

/** "Talk about S-0x": the contact form with that sheet preselected. */
export const talkHref = (id: ServiceId) => `/contact?sheet=${id}#book` as Route

/** The service sheet's anchor on /services. */
export const serviceHref = (id: ServiceId) => `/services#${id.toLowerCase()}` as Route

/** View-transition types for a sheet change: forward or back in reading order, or none. */
export function transitionTypes(from: string, to: string): string[] | undefined {
  const clean = (p: string) => p.split(/[?#]/)[0] || '/'
  const i = SHEET_ORDER.findIndex((k) => PATH[k] === clean(from))
  const j = SHEET_ORDER.findIndex((k) => PATH[k] === clean(to))
  return i < 0 || j < 0 || i === j ? undefined : [j > i ? 'sheet-forward' : 'sheet-back']
}
