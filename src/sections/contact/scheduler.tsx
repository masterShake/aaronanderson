import { SHOW_HOLDS, fact } from '@/content/hold'
import { site } from '@/content/site'
import { resolveScheduler } from '@/lib/scheduler'

/** The resolved booking link, or null while it is still a HOLD (owner: contact). */
export const scheduler = resolveScheduler(fact(site.scheduler.url) ?? null, new URL(site.url).host)

/**
 * No booking calendar on the page: the link is still a HOLD and review mode is off. The page
 * then promises only what it has (the form): the no-scheduler H1, first step, closing and
 * privacy rows, and the form section takes id="book".
 */
export const noScheduler = !scheduler && !SHOW_HOLDS
