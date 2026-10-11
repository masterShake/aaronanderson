import { fact } from '@/content/hold'
import { site } from '@/content/site'
import { resolveScheduler } from '@/lib/scheduler'

/** The resolved booking link, or null while it is still a HOLD (owner: contact). */
export const scheduler = resolveScheduler(fact(site.scheduler.url) ?? null, new URL(site.url).host)
