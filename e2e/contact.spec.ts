import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { isProductionBuild } from './helpers/budgets'

/**
 * Contact behaviour (lane w2/contact): the booking facade on the preview-only
 * /kit/contact bench (the real link is still a HOLD), with Cal.com's embed.js
 * stubbed (no network), and the form with JS on. Form tests run serially and
 * each sends from its own address (x-forwarded-for), so the in-memory rate
 * limit of one `next start` never leaks between them.
 */

const EMBED = 'https://app.cal.com/embed/embed.js'

/**
 * A stand-in for Cal.com's embed.js: drains the loader's queues, records
 * `on` callbacks, mounts a marker on `inline`, and fires linkReady or
 * linkFailed per window.__calMode ('ready' | 'failed' | 'never').
 * window.__calFire(action) fires any event from the test.
 */
const STUB = `(function () {
  var Cal = window.Cal, handlers = {}, mode = window.__calMode || 'ready';
  function fire(action) {
    (handlers[action] || []).forEach(function (cb) { cb({ detail: { type: action, data: {} } }); });
  }
  window.__calFire = fire;
  function handle(args) {
    var m = args[0], a = args[1];
    if (m === 'initNamespace') { patch(Cal.ns[a]); return; }
    if (m === 'on') { (handlers[a.action] = handlers[a.action] || []).push(a.callback); return; }
    if (m === 'inline') {
      var el = typeof a.elementOrSelector === 'string' ? document.querySelector(a.elementOrSelector) : a.elementOrSelector;
      var f = document.createElement('div');
      f.setAttribute('data-cal-stub', a.calLink);
      if (el) el.appendChild(f);
      if (mode === 'ready') setTimeout(function () { fire('linkReady'); }, 50);
      if (mode === 'failed') setTimeout(function () { fire('linkFailed'); }, 50);
    }
  }
  function patch(api) {
    if (!api || api.__stub) return;
    api.__stub = true;
    var q = api.q || [];
    api.q = { push: function (args) { handle(args); } };
    for (var i = 0; i < q.length; i++) handle(q[i]);
  }
  patch(Cal);
  Object.keys(Cal.ns || {}).forEach(function (k) { patch(Cal.ns[k]); });
})();`

async function stubCal(page: Page, mode: 'ready' | 'failed' | 'never') {
  const hits: string[] = []
  await page.addInitScript((m) => {
    ;(window as unknown as { __calMode: string }).__calMode = m
  }, mode)
  // registered after the fixture's network guard, so it wins for this URL
  await page.route(EMBED, (route) => {
    hits.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: STUB })
  })
  return hits
}

const status = (page: Page) => page.locator('[data-facade-status]')

test.describe('booking facade (/kit/contact)', () => {
  test.use({ bypassCSP: true })
  test.beforeEach(async ({ page }) => {
    test.skip(await isProductionBuild(page), '/kit/contact is preview only')
  })

  test('Cal mounts only after the click, then reports ready and booked', async ({ page }) => {
    const hits = await stubCal(page, 'ready')
    await page.goto('/kit/contact')
    const show = page.getByRole('button', { name: 'Show available times' })
    await expect(show).toBeVisible()
    await page.waitForTimeout(300)
    expect(hits).toEqual([])
    await expect(page.locator('[data-cal-stub]')).toHaveCount(0)
    await show.click()
    const region = page.getByRole('region', { name: 'Booking calendar' })
    await expect(region).toBeFocused()
    await expect(page.locator('[data-cal-stub="example/intro"]')).toHaveCount(1)
    expect(hits.length).toBe(1)
    await expect(status(page)).toHaveText('Booking calendar loaded.')
    await expect(region).toHaveAttribute('aria-busy', 'false')
    await page.evaluate(() =>
      (window as unknown as { __calFire: (a: string) => void }).__calFire('bookingSuccessfulV2'),
    )
    await expect(status(page)).toHaveText('Booked. Check your email for the invite.')
    await expect(page.locator('[data-facade="booked"]')).toBeVisible()
  })

  test('after eight seconds without the calendar it points to the form', async ({ page }) => {
    await page.clock.install()
    await stubCal(page, 'never')
    await page.goto('/kit/contact')
    await page.getByRole('button', { name: 'Show available times' }).click()
    await expect(status(page)).toHaveText('Loading the booking calendar…')
    await page.clock.fastForward(7_000)
    await expect(status(page)).toHaveText('Loading the booking calendar…')
    await page.clock.fastForward(1_100)
    await expect(status(page)).toHaveText(
      'Still loading. Open it in a new tab, or use the form below.',
    )
    await expect(page.locator('[data-facade="slow"]')).toBeVisible()
  })

  test('a failed calendar says so', async ({ page }) => {
    await stubCal(page, 'failed')
    await page.goto('/kit/contact')
    await page.getByRole('button', { name: 'Show available times' }).click()
    await expect(status(page)).toHaveText(
      "The calendar didn't load. Try the new-tab link, or write to us below.",
    )
  })

  test('a blocked embed script counts as failed', async ({ page }) => {
    await page.goto('/kit/contact')
    await page.getByRole('button', { name: 'Show available times' }).click()
    await expect(page.locator('[data-facade="failed"]')).toBeVisible()
  })

  test('the new-tab link is always there', async ({ page }) => {
    await page.goto('/kit/contact')
    const link = page.getByRole('link', { name: /Open the calendar in a new tab/ })
    await expect(link).toHaveAttribute('href', 'https://cal.com/example/intro')
    await expect(link).toHaveAttribute('target', '_blank')
  })
})

let ip = 0
async function fresh(page: Page) {
  ip += 1
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${process.pid % 250}.${ip}` })
}

async function fill(page: Page, email: string, message = 'We retype the weekly report by hand.') {
  await page.locator('#f-name').fill('Sam Field')
  await page.locator('#f-email').fill(email)
  await page.locator('#f-company').fill('Field Works')
  await page.locator('#f-message').fill(message)
}

test.describe('contact form with JS', () => {
  test.describe.configure({ mode: 'serial' })

  test('an empty send shows the focused summary and a cloud per field', async ({ page }) => {
    await fresh(page)
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send it' }).click()
    const summary = page.locator('#form-errors')
    await expect(summary).toBeFocused()
    await expect(summary.getByRole('link')).toHaveCount(3)
    await expect(page.locator('#f-email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#f-email')).toHaveAttribute(
      'aria-describedby',
      'f-email-hint f-email-err',
    )
    await expect(page.locator('[data-invalid]')).toHaveCount(3)
  })

  test('a send shows the success panel and fetches a fresh token', async ({ page, guard }) => {
    test.skip(await isProductionBuild(page), 'production without mail env: not_configured')
    await fresh(page)
    let actions = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action']) actions += 1
    })
    await page.goto('/contact')
    await fill(page, `sam.${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Send it' }).click()
    const sent = page.locator('[role="status"]').filter({ hasText: 'Received.' })
    await expect(sent).toContainText('Thanks, Sam Field.')
    await expect(sent).toContainText('Sent. Your node joins ours.')
    await expect(sent.locator('img')).toHaveAttribute(
      'src',
      '/drawings/after-contact.wide.received.still.svg',
    )
    // their node carries the company name
    await expect(sent).toContainText('Field Works')
    // token on focus, the send, then a fresh token
    await expect.poll(() => actions).toBeGreaterThanOrEqual(3)
    await expect(page.locator('#f-message')).toHaveValue('')
    expect(guard.errors).toEqual([])
  })

  test('?sheet=S-03 preselects S-03', async ({ page }) => {
    await page.goto('/contact?sheet=S-03#write')
    await expect(page.locator('#f-sheet')).toHaveValue('S-03')
    await page.goto('/contact?sheet=s-05')
    await expect(page.locator('#f-sheet')).toHaveValue('S-05')
    await page.goto('/contact?sheet=nope')
    await expect(page.locator('#f-sheet')).toHaveValue('not-sure')
  })

  test('the rate limit shows its message and keeps the values', async ({ page }) => {
    test.skip(await isProductionBuild(page), 'production without mail env: not_configured')
    await fresh(page)
    await page.goto('/contact')
    const email = `limit.${Date.now()}@example.com`
    for (let i = 0; i < 3; i++) {
      await fill(page, email)
      await page.getByRole('button', { name: 'Send it' }).click()
      // this send's own success reset: 'Received.' may still show from the previous one
      await expect(page.locator('#f-message')).toHaveValue('')
      await expect(page.locator('[role="status"]').filter({ hasText: 'Received.' })).toBeVisible()
    }
    await fill(page, email)
    await page.getByRole('button', { name: 'Send it' }).click()
    const summary = page.locator('#form-errors')
    await expect(summary).toBeFocused()
    await expect(summary).toContainText('Too many messages from this connection.')
    await expect(page.locator('#f-email')).toHaveValue(email)
  })

  test('production without the mail settings says the form is not switched on', async ({
    page,
  }) => {
    test.skip(!(await isProductionBuild(page)), 'needs a VERCEL_ENV=production build')
    await fresh(page)
    await page.goto('/contact')
    await fill(page, `prod.${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Send it' }).click()
    const summary = page.locator('#form-errors')
    await expect(summary).toBeFocused()
    await expect(summary).toContainText("The form isn't switched on yet.")
    await expect(page.locator('#f-message')).toHaveValue('We retype the weekly report by hand.')
  })
})
