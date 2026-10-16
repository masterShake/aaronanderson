/**
 * The hostnames Turnstile's siteverify may report for this deployment (code-platform-8):
 * the site's own host, plus the deployment's hostnames when the platform sets them
 * (RENDER_EXTERNAL_HOSTNAME on Render; VERCEL_URL and VERCEL_BRANCH_URL on Vercel), each
 * skipped when unset. localhost and 127.0.0.1 count outside production only. Hosts are
 * compared without a leading "www.", as verifyTurnstile compares them.
 */

const DEPLOY_HOST_VARS = ['RENDER_EXTERNAL_HOSTNAME', 'VERCEL_URL', 'VERCEL_BRANCH_URL'] as const

/** "https://www.x.com:3000/path" or "x.com" → "x.com". Empty for an empty value. */
export function bareHost(v: string | undefined): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  try {
    return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname
      .toLowerCase()
      .replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function turnstileHosts(o: {
  siteUrl: string
  production: boolean
  env: Readonly<Record<string, string | undefined>>
}): string[] {
  const hosts = [o.siteUrl, ...DEPLOY_HOST_VARS.map((k) => o.env[k])].map(bareHost)
  if (!o.production) hosts.push('localhost', '127.0.0.1')
  return [...new Set(hosts.filter(Boolean))]
}
