import localFont from 'next/font/local'

/**
 * The site's faces, self-hosted from src/app/fonts (fetched once by
 * scripts/fetch-fonts.mjs). Each is a pinned instance, so the width and
 * optical size are baked in. Only the three faces above the fold preload:
 * the display face, the body face and the UI face (about 65 KB together).
 */

export const display = localFont({
  src: './fonts/big-shoulders-opsz72-800.latin.woff2',
  weight: '800',
  display: 'optional',
  variable: '--font-display',
})

export const stencil = localFont({
  src: './fonts/big-shoulders-stencil-opsz72-800.latin.woff2',
  weight: '800',
  display: 'optional',
  preload: false,
  variable: '--font-stencil',
})

export const body = localFont({
  src: './fonts/archivo-semiexpanded-400-700.latin.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-body',
})

export const ui = localFont({
  src: './fonts/archivo-expanded-700.latin.woff2',
  weight: '700',
  display: 'swap',
  variable: '--font-ui',
})

/**
 * Mono and hand fall back to the system monospace, never a size-adjusted Arial: with
 * display 'optional' a cold visit keeps the fallback for the whole page, and labels must
 * still read as mono (D7, craft-10).
 */
export const mono = localFont({
  src: './fonts/martian-mono-semicondensed-400-600.latin.woff2',
  weight: '400 600',
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
  variable: '--font-mono',
})

export const hand = localFont({
  src: './fonts/architects-daughter-400.latin.woff2',
  weight: '400',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-hand',
})

/**
 * Arrows, Δ, ≈ and ✓ that the latin subsets lack. Its unicode-range keeps it
 * from claiming anything else, so it can sit first in every stack (tokens.css)
 * and still beat the size-adjusted local Arial fallback on macOS.
 */
export const sym = localFont({
  src: './fonts/symbols-martian-mono-500.woff2',
  weight: '500',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-sym',
  declarations: [{ prop: 'unicode-range', value: 'U+2190-21FF, U+0394, U+2248, U+2713' }],
})

/** Every face's CSS variable, for the className on <html>. */
export const fontVariables = [display, stencil, body, ui, mono, hand, sym]
  .map((f) => f.variable)
  .join(' ')
