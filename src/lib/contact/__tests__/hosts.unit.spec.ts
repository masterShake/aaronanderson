import { test, expect } from '@playwright/test'
import { services } from '@/content/services'
import { contact } from '@/content/pages/contact'
import { bareHost, turnstileHosts } from '../hosts'
import { bookingNotes } from '../booking'

/** Turnstile's allowed hostnames per deployment, and the Cal.com booking notes from ?sheet. */

const SITE = 'https://www.actualengineer.com'

test('bareHost drops scheme, port, path and www', () => {
  expect(bareHost('https://www.actualengineer.com/contact')).toBe('actualengineer.com')
  expect(bareHost('ae-git-main.vercel.app')).toBe('ae-git-main.vercel.app')
  expect(bareHost('ae.onrender.com:443')).toBe('ae.onrender.com')
  expect(bareHost('  ')).toBe('')
  expect(bareHost(undefined)).toBe('')
})

test('production: the site host plus each deployment host that is set', () => {
  expect(turnstileHosts({ siteUrl: SITE, production: true, env: {} })).toEqual([
    'actualengineer.com',
  ])
  expect(
    turnstileHosts({
      siteUrl: SITE,
      production: true,
      env: {
        RENDER_EXTERNAL_HOSTNAME: 'actualengineer.onrender.com',
        VERCEL_URL: 'ae-abc123.vercel.app',
        VERCEL_BRANCH_URL: 'ae-git-main.vercel.app',
      },
    }),
  ).toEqual([
    'actualengineer.com',
    'actualengineer.onrender.com',
    'ae-abc123.vercel.app',
    'ae-git-main.vercel.app',
  ])
  // unset or empty values are skipped, and localhost never counts in production
  const prod = turnstileHosts({
    siteUrl: SITE,
    production: true,
    env: { RENDER_EXTERNAL_HOSTNAME: '', VERCEL_URL: undefined },
  })
  expect(prod).toEqual(['actualengineer.com'])
  expect(prod).not.toContain('localhost')
  expect(prod).not.toContain('127.0.0.1')
})

test('outside production: localhost and 127.0.0.1 count too, without duplicates', () => {
  expect(
    turnstileHosts({
      siteUrl: SITE,
      production: false,
      env: { VERCEL_URL: 'actualengineer.com' },
    }),
  ).toEqual(['actualengineer.com', 'localhost', '127.0.0.1'])
})

test('booking notes come from ?sheet only when the sheet resolves', () => {
  const sheets = Object.fromEntries(services.map((s) => [s.id, s.name]))
  const t = contact.bookingNotes
  const s03 = services.find((s) => s.id === 'S-03')!
  expect(bookingNotes('?sheet=S-03', sheets, t)).toBe(`About S-03 · ${s03.name}`)
  expect(bookingNotes('?sheet=s-03', sheets, t)).toBe(`About S-03 · ${s03.name}`)
  expect(bookingNotes('?sheet=nope', sheets, t)).toBeNull()
  expect(bookingNotes('', sheets, t)).toBeNull()
  expect(bookingNotes('?sheet=S-03', {}, t)).toBeNull()
})
