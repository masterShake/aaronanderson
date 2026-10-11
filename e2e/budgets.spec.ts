import { test, expect } from './fixtures'
import { ROUTES, pick } from './routes'
import { budgets, initialJs, kb, mergeParts, preloadedFonts, writePart } from './helpers/budgets'

/**
 * Byte budgets measured in the browser (PLAN Appendix B §B10), mobile project:
 * initial JS (gzip-9 of same-origin JS fetched before load + 2 s on
 * ?tier=still), the preloaded fonts, and no console errors on the way. The HTML
 * brotli budget is scripts/budgets/html-size.mjs (the second half of
 * `npm run perf:budgets`); the 3D chunk is scripts/check-3d-bundle.mjs.
 * Results: $ARTIFACTS_DIR/budgets/initial.json.
 */

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'mobile', 'budgets are measured on the mobile project')
})
test.afterAll(() => {
  mergeParts('budgets', 'initial.json')
})

const B = budgets().bytes
const paths: string[] = pick(
  ROUTES.map((x) => x.path as string),
  process.env.ROUTES,
  (s) => s,
)

for (const path of paths) {
  test(`initial JS and preloaded fonts ${path}`, async ({ page, guard }) => {
    const js = await initialJs(page, path)
    const fonts = await preloadedFonts(page)
    writePart('budgets', path === '/' ? 'home' : path.slice(1), {
      route: path,
      initialJsGzipKB: kb(js.gzipBytes),
      initialJsRawKB: kb(js.rawBytes),
      fontsPreloadKB: kb(fonts.bytes),
      limitsKB: { initialJsGzip: kb(B.initialJsGzip), preloadFonts: kb(B.preloadFonts) },
      js: js.files,
      fonts: fonts.files,
    })
    expect(js.status).toBe(200)
    expect(js.files.length, 'some JS was measured').toBeGreaterThan(0)
    expect(
      js.gzipBytes,
      `initial JS ${kb(js.gzipBytes)} KB gzip (max ${kb(B.initialJsGzip)} KB)`,
    ).toBeLessThanOrEqual(B.initialJsGzip)
    expect(
      fonts.bytes,
      `preloaded fonts ${kb(fonts.bytes)} KB (max ${kb(B.preloadFonts)} KB)`,
    ).toBeLessThanOrEqual(B.preloadFonts)
    expect(guard.errors, 'console errors').toEqual([])
    expect(guard.blocked, 'requests off 127.0.0.1').toEqual([])
  })
}
