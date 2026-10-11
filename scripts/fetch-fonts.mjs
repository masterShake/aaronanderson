/**
 * Fetches the site's fonts once, from the Google Fonts CSS2 API with pinned
 * axes, and writes them into the repo: latin woff2 files for next/font/local,
 * a tiny symbols subset, static TTFs for the OG images, and the OFL licenses.
 * The output is committed; nobody needs to run this again unless a face changes.
 *
 *   npm run fonts:fetch
 */
import { mkdir, writeFile } from 'node:fs/promises'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'
// Google serves static per-weight TTF instances to non-browser user agents.
const TTF_UA = 'curl/8.7.1'
const API = 'https://fonts.googleapis.com/css2?display=swap&family='

/** [family query, output file, preloaded?] */
const WEB = [
  ['Big+Shoulders:opsz,wght@72,800', 'big-shoulders-opsz72-800.latin.woff2', true],
  ['Big+Shoulders+Stencil:opsz,wght@72,800', 'big-shoulders-stencil-opsz72-800.latin.woff2', false],
  ['Archivo:wdth,wght@112.5,400..700', 'archivo-semiexpanded-400-700.latin.woff2', true],
  ['Archivo:wdth,wght@125,700', 'archivo-expanded-700.latin.woff2', true],
  ['Martian+Mono:wdth,wght@87.5,400..600', 'martian-mono-semicondensed-400-600.latin.woff2', false],
  ['Architects+Daughter', 'architects-daughter-400.latin.woff2', false],
]
/** Glyphs the latin subsets lack; served from one small Martian Mono face listed first in every stack. */
const SYMBOLS = '→←↑↓↗↘Δ≈✓×·–—…•°'
const OG = [
  ['Big+Shoulders:opsz,wght@72,800', 'big-shoulders-800.ttf'],
  ['Big+Shoulders+Stencil:opsz,wght@72,800', 'big-shoulders-stencil-800.ttf'],
  ['Archivo:wdth,wght@112.5,400', 'archivo-semiexpanded-400.ttf'],
  ['Martian+Mono:wdth,wght@87.5,500', 'martian-mono-semicondensed-500.ttf'],
]
const OFL = ['bigshoulders', 'bigshouldersstencil', 'archivo', 'martianmono', 'architectsdaughter']
const PRELOAD_BUDGET = 76800

const get = async (url, ua) => {
  const r = await fetch(url, { headers: { 'User-Agent': ua } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r
}
/** The woff2 in the CSS block marked latin, or the only one. */
const latinUrl = (css) => {
  const block = css.split('/* latin */')[1] ?? css
  const m = /url\((https:[^)]+\.woff2)\)/.exec(block)
  if (!m) throw new Error('no latin woff2 url')
  return m[1]
}
/** The first url() of this format. A text= subset is served as /l/font?kit=… with format('woff2'). */
const firstUrl = (css, ext) => {
  const m =
    new RegExp(`url\\((https:[^)]+\\.${ext})\\)`).exec(css) ??
    new RegExp(`url\\((https:[^)]+)\\) format\\('${ext === 'ttf' ? 'truetype' : ext}'\\)`).exec(css)
  if (!m) throw new Error(`no ${ext} url`)
  return m[1]
}
const save = async (path, res) => {
  const b = Buffer.from(await res.arrayBuffer())
  await writeFile(path, b)
  return b.length
}

await mkdir('src/app/fonts/licenses', { recursive: true })
await mkdir('src/assets/og', { recursive: true })

let preload = 0
for (const [q, out, pre] of WEB) {
  const css = await (await get(API + q, CHROME)).text()
  const n = await save(`src/app/fonts/${out}`, await get(latinUrl(css), CHROME))
  if (pre) preload += n
  console.log(`${out.padEnd(52)} ${n} B${pre ? ' (preload)' : ''}`)
}

const symCss = await (
  await get(`${API}Martian+Mono:wdth,wght@87.5,500&text=${encodeURIComponent(SYMBOLS)}`, CHROME)
).text()
const symBytes = await save(
  'src/app/fonts/symbols-martian-mono-500.woff2',
  await get(firstUrl(symCss, 'woff2'), CHROME),
)
console.log(`${'symbols-martian-mono-500.woff2'.padEnd(52)} ${symBytes} B`)

for (const [q, out] of OG) {
  const css = await (await get(API + q, TTF_UA)).text()
  const n = await save(`src/assets/og/${out}`, await get(firstUrl(css, 'ttf'), TTF_UA))
  console.log(`og/${out.padEnd(49)} ${n} B`)
}
for (const d of OFL) {
  await save(
    `src/app/fonts/licenses/OFL-${d}.txt`,
    await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${d}/OFL.txt`, CHROME),
  )
}

console.log(`preloaded total ${preload} B (budget ${PRELOAD_BUDGET} B)`)
if (preload > PRELOAD_BUDGET) process.exit(1)
