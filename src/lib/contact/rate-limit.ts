/**
 * Fixed-window rate limits (pages-drawings §8.2 step 4): `ip:{ip}` 5 per 10
 * minutes and `em:{sha256(email)}` 3 per 24 hours. Upstash Redis over REST
 * when its env is set (UPSTASH_REDIS_REST_URL/_TOKEN or KV_REST_API_URL/_TOKEN;
 * no SDK), otherwise an in-memory Map on globalThis, pruned on access. Best
 * effort: a Redis failure lets the message through. No 'server-only': unit tests import it.
 */

export const LIMITS = {
  ip: { limit: 5, windowMs: 10 * 60_000 },
  email: { limit: 3, windowMs: 24 * 3_600_000 },
} as const

export interface Hit {
  ok: boolean
  count: number
  resetMs: number
}

export interface Limiter {
  hit(key: string, limit: number, windowMs: number): Promise<Hit>
}

type Bucket = { count: number; until: number }
const STORE = Symbol.for('ae.contact.rate-limit')

export function memoryLimiter(
  store: Map<string, Bucket> = ((globalThis as Record<symbol, unknown>)[STORE] ??= new Map<
    string,
    Bucket
  >()) as Map<string, Bucket>,
  now: () => number = Date.now,
): Limiter {
  return {
    async hit(key, limit, windowMs) {
      const t = now()
      for (const [k, b] of store) if (b.until <= t) store.delete(k)
      const b = store.get(key) ?? { count: 0, until: t + windowMs }
      b.count += 1
      store.set(key, b)
      return { ok: b.count <= limit, count: b.count, resetMs: b.until - t }
    },
  }
}

export function upstashLimiter(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Limiter {
  return {
    async hit(key, limit, windowMs) {
      const k = `ae:contact:${key}`
      try {
        const res = await fetchImpl(`${url.replace(/\/+$/, '')}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([
            ['SET', k, '0', 'PX', String(windowMs), 'NX'],
            ['INCR', k],
            ['PTTL', k],
          ]),
          cache: 'no-store',
        })
        if (!res.ok) return { ok: true, count: 0, resetMs: 0 }
        const out = (await res.json()) as { result?: unknown }[]
        const count = Number(out[1]?.result ?? 0)
        const ttl = Number(out[2]?.result ?? windowMs)
        return { ok: count <= limit, count, resetMs: ttl }
      } catch {
        return { ok: true, count: 0, resetMs: 0 }
      }
    },
  }
}

export function limiterFromEnv(env: Readonly<Record<string, string | undefined>>): Limiter {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  return url && token ? upstashLimiter(url, token) : memoryLimiter()
}

/** Both limits for one submission; false when either is over. */
export async function withinLimits(
  limiter: Limiter,
  ip: string,
  emailHash: string,
): Promise<boolean> {
  const a = await limiter.hit(`ip:${ip}`, LIMITS.ip.limit, LIMITS.ip.windowMs)
  if (!a.ok) return false
  const b = await limiter.hit(`em:${emailHash}`, LIMITS.email.limit, LIMITS.email.windowMs)
  return b.ok
}
