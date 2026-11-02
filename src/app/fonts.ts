import { Archivo } from 'next/font/google'

/**
 * One variable file for the whole site: Archivo's width axis gives tall condensed headings
 * (font-stretch 62.5%) and a wide, thin body (font-stretch 125%) from the same skeleton.
 * `weight` must be omitted when `axes` is set. The automatic fallback is sized for the default
 * width, so it is off; globals.css uses width-matched fallback stacks instead.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-archivo',
})
