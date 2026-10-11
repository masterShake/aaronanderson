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

test('SHOW_HOLDS is on outside production builds', () => {
  expect(SHOW_HOLDS).toBe(true)
})

test('hold() makes a frozen, registered HOLD', () => {
  const h = hold('Test price', {
    id: 'test.price',
    kind: 'price',
    essential: true,
    prodFallback: 'Quoted',
  })
  expect(isHold(h)).toBe(true)
  expect(Object.isFrozen(h)).toBe(true)
  expect(h).toMatchObject({ id: 'test.price', essential: true, prodFallback: 'Quoted' })
  expect(holdRegistry()).toContain(h)
  expect(resolveHeld(h)).toEqual({ show: 'hold', hold: h })
  expect(resolveHeld('plain')).toEqual({ show: 'text', text: 'plain' })
  expect(fact(h)).toBeUndefined()
  expect(fact('real')).toBe('real')
  expect(heldText(h)).toBe('HOLD: Test price')
})

test('confirm() defaults to pending; ok shows; cut never shows', () => {
  const pending = confirm('We reply fast.', { id: 'test.pending' })
  expect(isConfirm(pending)).toBe(true)
  expect(pending.status).toBe('pending')
  expect(resolveClaim(pending)).toEqual({
    show: 'value',
    value: 'We reply fast.',
    pending: true,
    id: 'test.pending',
  })
  expect(resolveClaim(confirm('Yes.', { id: 'test.ok', status: 'ok' }))).toMatchObject({
    show: 'value',
    pending: false,
  })
  expect(resolveClaim(confirm('No.', { id: 'test.cut', status: 'cut' }))).toEqual({ show: 'omit' })
  expect(resolveClaim('plain')).toEqual({ show: 'value', value: 'plain', pending: false, id: null })
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
