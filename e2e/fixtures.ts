import { test as base, expect } from '@playwright/test'

/**
 * The shared test fixture. Every page gets:
 * - a network guard: any request not to 127.0.0.1 is aborted (and recorded)
 *   unless E2E_NETWORK=1, so no test ever depends on, or leaks to, the internet;
 * - a console collector: console errors and page errors, for `expect(...).toEqual([])`.
 */

export interface Guarded {
  /** Requests the guard aborted. */
  blocked: string[]
  /** console.error messages and uncaught page errors. */
  errors: string[]
}

export const test = base.extend<{ guard: Guarded }>({
  guard: [
    async ({ page }, use) => {
      const g: Guarded = { blocked: [], errors: [] }
      if (process.env.E2E_NETWORK !== '1') {
        await page.route('**/*', (route) => {
          const url = new URL(route.request().url())
          if (url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:')
            return route.continue()
          g.blocked.push(url.href)
          return route.abort('blockedbyclient')
        })
      }
      page.on('console', (m) => {
        if (m.type() === 'error') g.errors.push(m.text())
      })
      page.on('pageerror', (e) => g.errors.push(e.message))
      await use(g)
    },
    { auto: true },
  ],
})

export { expect }
