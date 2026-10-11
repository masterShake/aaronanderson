import { test, expect } from '@playwright/test'
import { services } from '@/content/services'
import { SHEET_IDS, checkValues } from '../fields'
import { parseContact } from '../schema'
import { createTokens, MISSING_SECRET_LOG, TOKEN_MIN_MS, TOKEN_MAX_MS } from '../token'
import { scoreSubmission } from '../score'
import { memoryLimiter, withinLimits, LIMITS } from '../rate-limit'
import { sendContactMail, type MailClient, type MailPayload } from '../mail'
import { idempotencyKey, runContact, type PipelineDeps } from '../pipeline'

/**
 * The contact pipeline without a server: scoring, the time token (and its
 * single missing-secret log in production), the rate limit, and the mail
 * call's idempotency key (second argument, new per send).
 */

const MSG = { min: 20, max: 2000 }
const T0 = 1_800_000_000_000

test('sheet ids match services[].id', () => {
  expect([...SHEET_IDS]).toEqual(services.map((s) => s.id))
})

test('client and server agree on the field rules', () => {
  const ok = {
    name: 'Sam',
    email: 'sam@example.com',
    company: '',
    sheet: 'S-02',
    message: 'We retype the weekly report.',
  }
  expect(checkValues(ok, MSG)).toEqual({})
  expect(parseContact(ok, MSG).ok).toBe(true)
  const bad = { name: '', email: 'nope', company: '', sheet: 'x', message: 'short   ' }
  expect(checkValues(bad, MSG)).toEqual({ name: 'required', email: 'email', message: 'tooShort' })
  const parsed = parseContact(bad, MSG)
  expect(parsed.ok).toBe(false)
  if (!parsed.ok)
    expect(parsed.errors).toEqual({ name: 'required', email: 'email', message: 'tooShort' })
  // an unknown sheet falls back instead of failing; $ACTION_ keys are stripped
  const extra = parseContact({ ...ok, sheet: 'S-99', $ACTION_ID_x: '' }, MSG)
  expect(extra.ok && extra.data.sheet).toBe('not-sure')
})

test.describe('score', () => {
  const ok = { status: 'ok', nonce: 'n' } as const
  test('a clean message is sent as is', () => {
    expect(scoreSubmission({ honeypot: '', token: ok, message: 'hi' })).toEqual({
      score: 0,
      signals: [],
      verdict: 'send',
    })
  })
  test('the honeypot alone drops it', () => {
    const r = scoreSubmission({ honeypot: 'buy now', token: ok, message: 'hi' })
    expect(r.signals).toEqual(['honeypot'])
    expect(r.verdict).toBe('drop')
  })
  test('too fast is flagged, not rejected', () => {
    const r = scoreSubmission({
      honeypot: '',
      token: { status: 'fast', nonce: 'n' },
      message: 'hi',
    })
    expect(r).toEqual({ score: 1, signals: ['token-fast'], verdict: 'flag' })
  })
  test('no token (no JS) is a weak signal', () => {
    expect(scoreSubmission({ honeypot: '', token: { status: 'missing' }, message: 'hi' })).toEqual({
      score: 0.5,
      signals: ['token-missing'],
      verdict: 'send',
    })
  })
  test('too fast and full of links is dropped', () => {
    const r = scoreSubmission({
      honeypot: '',
      token: { status: 'fast', nonce: 'n' },
      message: 'see http://a.example https://b.example www.c.example',
    })
    expect(r.signals).toEqual(['token-fast', 'links'])
    expect(r.verdict).toBe('drop')
  })
  test('a bad or expired token weighs one', () => {
    expect(scoreSubmission({ honeypot: '', token: { status: 'bad' }, message: 'x' }).score).toBe(1)
    expect(
      scoreSubmission({ honeypot: '', token: { status: 'expired', nonce: 'n' }, message: 'x' })
        .score,
    ).toBe(1)
  })
})

test.describe('token', () => {
  test('valid from three seconds to two hours', () => {
    const t = createTokens({ secret: 's3cret', production: true })
    const tok = t.issue(T0)
    expect(t.verify(tok, T0 + 1_000).status).toBe('fast')
    expect(t.verify(tok, T0 + TOKEN_MIN_MS).status).toBe('ok')
    expect(t.verify(tok, T0 + TOKEN_MAX_MS + 1).status).toBe('expired')
    expect(t.verify(`${tok}x`, T0 + 5_000).status).toBe('bad')
    expect(t.verify(tok.replace(/^\d+/, String(T0 - 60_000)), T0 + 5_000).status).toBe('bad')
    expect(createTokens({ secret: 'other', production: true }).verify(tok, T0 + 5_000).status).toBe(
      'bad',
    )
    expect(t.verify(undefined).status).toBe('missing')
  })

  test('production without FORM_TOKEN_SECRET: tokens count as missing, logged once', () => {
    const lines: string[] = []
    const t = createTokens({ fallback: 're_key', production: true, log: (l) => lines.push(l) })
    expect(t.issue(T0)).toBe('')
    const other = createTokens({ secret: 's', production: true }).issue(T0)
    expect(t.verify(other, T0 + 5_000).status).toBe('missing')
    expect(t.verify('', T0).status).toBe('missing')
    expect(lines).toEqual([MISSING_SECRET_LOG])
  })

  test('outside production it falls back and never logs', () => {
    const lines: string[] = []
    const t = createTokens({ production: false, log: (l) => lines.push(l) })
    expect(t.verify(t.issue(T0), T0 + 5_000).status).toBe('ok')
    expect(lines).toEqual([])
  })
})

test('rate limit: five per address window, three per email per day', async () => {
  let now = T0
  const lim = memoryLimiter(new Map(), () => now)
  for (let i = 0; i < LIMITS.ip.limit; i++)
    expect(await withinLimits(lim, '1.1.1.1', `e${i}`)).toBe(true)
  expect(await withinLimits(lim, '1.1.1.1', 'e9')).toBe(false)
  now += LIMITS.ip.windowMs + 1
  expect(await withinLimits(lim, '1.1.1.1', 'e9')).toBe(true)
  for (let i = 0; i < 2; i++) expect(await withinLimits(lim, `2.2.2.${i}`, 'same')).toBe(true)
  expect(await withinLimits(lim, '2.2.2.9', 'same')).toBe(true)
  expect(await withinLimits(lim, '2.2.2.10', 'same')).toBe(false)
})

/** A fake Resend client that records every call. */
function fakeResend() {
  const calls: { payload: MailPayload; options: { idempotencyKey: string } }[] = []
  const client: MailClient = {
    emails: {
      async send(payload, options) {
        calls.push({ payload, options })
        return { data: { id: `id-${calls.length}` }, error: null }
      },
    },
  }
  return { client, calls }
}

test.describe('sending', () => {
  const env = {
    apiKey: 're_test',
    to: 'a@x.test, b@x.test',
    from: 'AE <c@x.test>',
    production: true,
  }

  test('the idempotency key is the second argument, and each send in a view gets a new one', async () => {
    const { client, calls } = fakeResend()
    const tokens = createTokens({ secret: 'k', production: true })
    const deps = (now: number): PipelineDeps => ({
      message: MSG,
      ip: '3.3.3.3',
      tokens,
      limiter: memoryLimiter(new Map()),
      compose: (d) => ({ replyTo: d.email, subject: `RFI ${d.name}`, text: d.message }),
      send: (m, key) =>
        sendContactMail(
          m,
          key,
          env,
          () => client,
          () => {},
        ),
      now,
    })
    const form = (t: string) => ({
      name: 'Sam',
      email: 'sam@example.com',
      company: '',
      sheet: 'S-01',
      message: 'We retype the weekly report by hand.',
      extra_notes: '',
      ae_t: t,
    })
    // first send, then the client drops the token and fetches a fresh one
    const first = tokens.issue(T0)
    const a = await runContact(form(first), deps(T0 + 5_000))
    const second = tokens.issue(T0 + 6_000)
    const b = await runContact(form(second), deps(T0 + 11_000))
    expect(a.state.status).toBe('sent')
    expect(b.state.status).toBe('sent')
    expect(calls).toHaveLength(2)
    for (const c of calls) {
      expect(Object.keys(c.payload)).not.toContain('idempotencyKey')
      expect(c.options.idempotencyKey).toMatch(/^contact\/[\w-]+$/)
      expect(c.payload.replyTo).toBe('sam@example.com')
      expect(c.payload.to).toEqual(['a@x.test', 'b@x.test'])
    }
    expect(calls[0]!.options.idempotencyKey).toBe(`contact/${first.split('.')[1]}`)
    expect(calls[1]!.options.idempotencyKey).toBe(`contact/${second.split('.')[1]}`)
    expect(calls[0]!.options.idempotencyKey).not.toBe(calls[1]!.options.idempotencyKey)
  })

  test('without JS the key is a hash of email and message', () => {
    expect(idempotencyKey(undefined, 'a@b.test', 'hello')).toMatch(/^contact\/[0-9a-f]{32}$/)
    expect(idempotencyKey(undefined, 'a@b.test', 'hello')).toBe(
      idempotencyKey(undefined, 'a@b.test', 'hello'),
    )
    expect(idempotencyKey('nonce', 'a@b.test', 'hello')).toBe('contact/nonce')
  })

  test('a dropped submission is never sent but still reads as sent', async () => {
    const { client, calls } = fakeResend()
    const r = await runContact(
      {
        name: 'Bot',
        email: 'bot@example.com',
        company: '',
        sheet: '',
        message: 'Cheap links for you, many of them here.',
        extra_notes: 'filled',
      },
      {
        message: MSG,
        ip: '4.4.4.4',
        tokens: createTokens({ secret: 'k', production: true }),
        limiter: memoryLimiter(new Map()),
        compose: (d) => ({ replyTo: d.email, subject: 's', text: d.message }),
        send: (m, key) =>
          sendContactMail(
            m,
            key,
            env,
            () => client,
            () => {},
          ),
      },
    )
    expect(r.state.status).toBe('sent')
    expect(r.log.outcome).toBe('dropped')
    expect(calls).toHaveLength(0)
  })

  test('no key outside production logs instead of sending; production says not configured', async () => {
    const { client, calls } = fakeResend()
    const lines: string[] = []
    const m = { replyTo: 'a@b.test', subject: 's', text: 'secret body' }
    const dev = await sendContactMail(
      m,
      'contact/k',
      { production: false },
      () => client,
      (l, d) => lines.push(`${l} ${JSON.stringify(d ?? {})}`),
    )
    expect(dev).toEqual({ ok: true, id: 'dev-log', logged: true })
    expect(lines.join('\n')).not.toContain('secret body')
    expect(lines.join('\n')).not.toContain('a@b.test')
    const prod = await sendContactMail(
      m,
      'contact/k',
      { apiKey: 're_x', to: '', from: 'x', production: true },
      () => client,
      () => {},
    )
    expect(prod).toEqual({ ok: false, reason: 'not_configured' })
    expect(calls).toHaveLength(0)
  })

  test('a Resend error is send_failed', async () => {
    const client: MailClient = {
      emails: {
        async send() {
          return { data: null, error: { name: 'rate_limit_exceeded', message: 'slow down' } }
        },
      },
    }
    const r = await sendContactMail(
      { replyTo: 'a@b.test', subject: 's', text: 't' },
      'contact/k',
      env,
      () => client,
      () => {},
    )
    expect(r).toEqual({ ok: false, reason: 'send_failed' })
  })
})
