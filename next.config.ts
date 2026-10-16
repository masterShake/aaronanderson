import type { NextConfig } from 'next'
import { site } from './src/content/site'
import { isHold } from './src/content/hold'
import { resolveScheduler } from './src/lib/scheduler'
import { buildCsp } from './src/lib/csp'

/**
 * Next compiles this file with SWC to CommonJS, so the tsconfig paths and the
 * relative imports above both work. Never pass --experimental-next-config-strip-types.
 * The modules imported here have no other runtime imports; keep it that way.
 */

/** production | preview | development on Vercel; local everywhere else. */
const VERCEL_ENV = process.env.VERCEL_ENV ?? 'local'
const IS_PROD_DEPLOY = VERCEL_ENV === 'production'
/**
 * Review mode (HOLD clouds, CONFIRM marks) only when the build sets SHOW_HOLDS=1. Every other
 * build, local or deployed, shows the production look. /punch-list does not depend on it.
 */
const SHOW_HOLDS = process.env.SHOW_HOLDS === '1' ? '1' : '0'

const scheduler = resolveScheduler(
  isHold(site.scheduler.url) ? null : site.scheduler.url,
  new URL(site.url).host,
)
const csp = buildCsp({
  isDev: process.env.NODE_ENV === 'development',
  onVercel: Boolean(process.env.VERCEL),
  scheduler,
  turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  vercelToolbar: VERCEL_ENV === 'preview',
})
const CSP_HEADER =
  process.env.CSP_MODE === 'report'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: false,
  cacheComponents: false,
  reactStrictMode: true,
  poweredByHeader: false,
  // The worktrees live inside this folder, so pin both roots to it.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Inlined into server and client bundles at build time.
  env: { SHOW_HOLDS, SITE_ENV: VERCEL_ENV },
  images: { formats: ['image/avif', 'image/webp'], qualities: [60, 75] },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: CSP_HEADER, value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          ...(IS_PROD_DEPLOY ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
        ],
      },
    ]
  },
}

export default nextConfig
