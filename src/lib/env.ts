/**
 * Build-time environment, inlined by next.config.ts `env`. Static: every value
 * is decided when the site is built, never per request.
 */

/** 'production' | 'preview' | 'development' on Vercel; 'local' elsewhere. */
export const SITE_ENV: string = process.env.SITE_ENV ?? 'local'
/** A production deployment: indexable, no HOLDs, no preview pages, no debug hooks. */
export const IS_PRODUCTION = SITE_ENV === 'production'
/** Review mode: HOLD clouds and CONFIRM marks are visible. Only on a SHOW_HOLDS=1 build. */
export const SHOW_HOLDS = process.env.SHOW_HOLDS === '1'
/** /kit and /punch-list render; production returns 404 for both. */
export const PREVIEW_PAGES = !IS_PRODUCTION
/** window.__aeStage and other test hooks exist. */
export const DEBUG_HOOKS = !IS_PRODUCTION
