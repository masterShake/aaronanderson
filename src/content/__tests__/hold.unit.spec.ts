import { test, expect } from '@playwright/test'
import {
  confirm,
  fact,
  heldText,
  hold,
  holdRegistry,
  isConfirm,
  isHold,
  resolveClaim,
  resolveHeld,
  SHOW_HOLDS,
} from '../hold'
import { timingCss, cssVars } from '@/motion/timing-css'
import { transitionTypes } from '@/lib/routes'
import { resolveScheduler } from '@/lib/scheduler'
import { buildCsp } from '@/lib/csp'

/** Unit tests for the HOLD/CONFIRM contract and the small pure helpers. No browser. */

test('review mode is on only when the build sets SHOW_HOLDS=1', () => {
  expect(SHOW_HOLDS).toBe(process.env.SHOW_HOLDS === '1')
})

test('hold() makes a frozen, registered HOLD', () => {
  const h = hold('Test price', {
    id: 'test.price',
    kind: 'price',
    essential: true,
    prodFallback: 'Quoted',
  })
  const gone = hold('Test name', { id: 'test.name', kind: 'name' })
  expect(isHold(h)).toBe(true)
  expect(Object.isFrozen(h)).toBe(true)
  expect(h).toMatchObject({ id: 'test.price', essential: true, prodFallback: 'Quoted' })
  expect(holdRegistry()).toContain(h)
  // review mode marks the HOLD
  expect(resolveHeld(h, true)).toEqual({ show: 'hold', hold: h })
  expect(heldText(h, true)).toBe('HOLD: Test price')
  // the production look shows the fallback, or leaves the element out
  expect(resolveHeld(h, false)).toEqual({ show: 'text', text: 'Quoted' })
  expect(resolveHeld(gone, false)).toEqual({ show: 'omit' })
  expect(heldText(h, false)).toBe('Quoted')
  expect(heldText(gone, false)).toBeUndefined()
  // the default follows the build
  expect(resolveHeld(h)).toEqual(resolveHeld(h, SHOW_HOLDS))
  expect(resolveHeld('plain')).toEqual({ show: 'text', text: 'plain' })
  expect(resolveHeld('plain', true)).toEqual({ show: 'text', text: 'plain' })
  expect(fact(h)).toBeUndefined()
  expect(fact('real')).toBe('real')
})

test('confirm() defaults to pending; ok shows; cut never shows', () => {
  const pending = confirm('We reply fast.', { id: 'test.pending' })
  expect(isConfirm(pending)).toBe(true)
  expect(pending.status).toBe('pending')
  expect(resolveClaim(pending, true)).toEqual({
    show: 'value',
    value: 'We reply fast.',
    pending: true,
    id: 'test.pending',
  })
  // the production look leaves a pending claim out
  expect(resolveClaim(pending, false)).toEqual({ show: 'omit' })
  expect(resolveClaim(pending)).toEqual(resolveClaim(pending, SHOW_HOLDS))
  const ok = confirm('Yes.', { id: 'test.ok', status: 'ok' })
  for (const review of [true, false]) {
    expect(resolveClaim(ok, review)).toMatchObject({ show: 'value', pending: false })
    expect(resolveClaim(confirm('No.', { id: 'test.cut', status: 'cut' }), review)).toEqual({
      show: 'omit',
    })
    expect(resolveClaim('plain', review)).toEqual({
      show: 'value',
      value: 'plain',
      pending: false,
      id: null,
    })
  }
})

test('timing serializes to CSS with units only on durations', () => {
  expect(timingCss).toContain('--dur-scan:1200ms')
  expect(timingCss).toContain('--flow-speed:140')
  expect(timingCss).toContain('--gate-css-auto-start:4000ms')
  expect(timingCss).toContain('--gate-entry:0.4')
  expect(cssVars({ scanStart: 1750, packetSpeed: 140 }, 'hero')).toEqual({
    '--hero-scan-start': '1750ms',
    '--hero-packet-speed': '140',
  })
})

test('sheet transitions follow reading order', () => {
  expect(transitionTypes('/', '/services')).toEqual(['sheet-forward'])
  expect(transitionTypes('/contact', '/about')).toEqual(['sheet-back'])
  expect(transitionTypes('/about', '/about#crew')).toBeUndefined()
  expect(transitionTypes('/kit', '/')).toBeUndefined()
})

test('the scheduler link drives the CSP', () => {
  expect(resolveScheduler(null, 'actualengineer.com')).toBeNull()
  const cal = resolveScheduler('https://cal.com/actualengineer/intro', 'actualengineer.com')
  expect(cal).toMatchObject({
    provider: 'cal',
    calLink: 'actualengineer/intro',
    namespace: 'intro',
  })
  const csp = buildCsp({
    isDev: false,
    onVercel: true,
    scheduler: cal,
    turnstile: false,
    vercelToolbar: false,
  })
  expect(csp).toContain('frame-src https://app.cal.com')
  expect(csp).not.toContain('unsafe-eval')
  expect(csp).toContain('upgrade-insecure-requests')
  const none = buildCsp({
    isDev: false,
    onVercel: false,
    scheduler: null,
    turnstile: false,
    vercelToolbar: false,
  })
  expect(none).toContain("frame-src 'none'")
})
