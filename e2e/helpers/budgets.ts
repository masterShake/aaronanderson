import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import {
  initialJs as measureInitialJs,
  preloadedFonts as measureFonts,
} from '../../scripts/budgets/measure.mjs'

/**
 * Measurement helpers for the platform specs: the §B10 byte budgets (shared
 * with scripts/budgets/measure.mjs), budgets.json, and where every spec writes
 * its output ($ARTIFACTS_DIR/<sub>, else artifacts/<sub>, which git ignores).
 */

const ROOT = join(__dirname, '..', '..')

export interface Budgets {
  routes: string[]
  lab: {
    lcpTargetMs: number
    lcpFailMs: number
    clsFail: number
    tbtTargetMs: number
    tbtFailMs: number
  }
  bytes: {
    initialJsGzip: number
    htmlBrotli: number
    preloadFonts: number
    [k: string]: number
  }
}

export const budgets = (): Budgets => JSON.parse(readFileSync(join(ROOT, 'budgets.json'), 'utf8'))

export interface JsFile {
  url: string
  raw: number
  gzip: number
}

/** Initial JS on ?tier=still: gzip-9 sum of same-origin JS fetched before load + 2 s. */
export const initialJs = (
  page: Page,
  url: string,
  opts?: { settleMs?: number },
): Promise<{ status: number; gzipBytes: number; rawBytes: number; files: JsFile[] }> =>
  measureInitialJs(page, url, opts)

/** The fonts the current page preloads, with their byte sizes. */
export const preloadedFonts = (
  page: Page,
): Promise<{ bytes: number; files: { url: string; bytes: number }[] }> => measureFonts(page)

export const kb = (n: number) => Math.round((n / 1024) * 10) / 10

/** The folder a spec writes into: $ARTIFACTS_DIR/<sub>, else artifacts/<sub>. Created. */
export function artifactsDir(sub: string): string {
  const dir = process.env.ARTIFACTS_DIR
    ? join(process.env.ARTIFACTS_DIR, sub)
    : join(ROOT, 'artifacts', sub)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeArtifact(sub: string, name: string, data: unknown): string {
  const file = join(artifactsDir(sub), name)
  writeFileSync(file, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`)
  return file
}

/**
 * Parallel tests each write one JSON fragment into <sub>/parts; mergeParts()
 * folds every fragment written so far into <sub>/<name> (call it in afterAll:
 * the last worker to finish writes the complete file).
 */
export const writePart = (sub: string, key: string, data: unknown) =>
  writeArtifact(join(sub, 'parts'), `${key.replace(/[^\w.-]+/g, '_')}.json`, data)

export function mergeParts(sub: string, name: string): string {
  const dir = artifactsDir(join(sub, 'parts'))
  const merged: Record<string, unknown> = {}
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.json'))
    .sort())
    merged[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  return writeArtifact(sub, name, merged)
}

/** Width and height of a PNG, from its IHDR chunk. */
export function pngSize(buf: Buffer): { width: number; height: number } {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** Is this a production-mode build? Production returns 404 for /punch-list. */
export async function isProductionBuild(page: Page): Promise<boolean> {
  const r = await page.request.get('/punch-list', { maxRedirects: 0 })
  return r.status() === 404
}
