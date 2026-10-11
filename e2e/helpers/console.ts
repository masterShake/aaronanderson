import type { Page } from '@playwright/test'

declare global {
  interface Window {
    /** CSP violations recorded by watchCsp(). */
    __csp: string[]
  }
}

/** Records CSP violations into window.__csp from the first script on. Call before goto. */
export async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    window.__csp = []
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    )
  })
}

export const cspViolations = (page: Page) => page.evaluate(() => window.__csp ?? [])

/** Console errors and page errors from now on (when not using the guard fixture). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}
