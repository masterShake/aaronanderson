/**
 * HOLD and CONFIRM: how the site marks what the owner still has to supply
 * (a HOLD) and the promises the owner still has to agree to (a CONFIRM).
 *
 * No imports: next.config.ts loads this file. Frozen after W0.
 */

export type HoldKind =
  | 'text'
  | 'price'
  | 'duration'
  | 'email'
  | 'phone'
  | 'url'
  | 'name'
  | 'role'
  | 'bio'
  | 'photo'
  | 'location'
  | 'policy'
  | 'proof'
  | 'count'

export interface HoldOptions {
  /** Unique dotted id, e.g. 'price.s01'. Used by the punch list, the tests and /punch-list. */
  readonly id: string
  readonly kind: HoldKind
  /** STRICT_HOLDS=1 fails the build while this HOLD remains. */
  readonly essential?: boolean
  /** Text production renders instead. Omit or null and production removes the element. Must pass check-content. */
  readonly prodFallback?: string | null
}

export interface Hold {
  readonly $: 'hold'
  readonly id: string
  readonly note: string
  readonly kind: HoldKind
  readonly essential: boolean
  readonly prodFallback: string | null
}

/** pending: preview shows it with a CONFIRM mark, production leaves it out. ok: shown everywhere. cut: never shown. */
export type ConfirmStatus = 'pending' | 'ok' | 'cut'

export interface Confirm<T = string> {
  readonly $: 'confirm'
  readonly id: string
  readonly value: T
  readonly status: ConfirmStatus
}

export type Held = string | Hold
export type Claim = Confirm<string>

/**
 * Review mode. Inlined by next.config.ts `env`: on only when the build sets SHOW_HOLDS=1.
 * Every other build (local dev, next start, previews, production) shows the production look.
 */
export const SHOW_HOLDS: boolean = process.env.SHOW_HOLDS === '1'

const registry = new Map<string, Hold | Confirm<unknown>>()

/** Something the owner still has to supply, with what production shows meanwhile. */
export function hold(note: string, o: HoldOptions): Hold {
  const h: Hold = Object.freeze({
    $: 'hold',
    id: o.id,
    note,
    kind: o.kind,
    essential: o.essential ?? false,
    prodFallback: o.prodFallback ?? null,
  })
  registry.set(h.id, h)
  return h
}

/** A promise the owner has to agree to before production shows it. */
export function confirm<T = string>(
  value: T,
  o: { readonly id: string; readonly status?: ConfirmStatus },
): Confirm<T> {
  const c: Confirm<T> = Object.freeze({
    $: 'confirm',
    id: o.id,
    value,
    status: o.status ?? 'pending',
  })
  registry.set(c.id, c as Confirm<unknown>)
  return c
}

export const isHold = (v: unknown): v is Hold =>
  typeof v === 'object' && v !== null && (v as { $?: unknown }).$ === 'hold'

export const isConfirm = (v: unknown): v is Confirm<unknown> =>
  typeof v === 'object' && v !== null && (v as { $?: unknown }).$ === 'confirm'

export type Resolved =
  | { readonly show: 'text'; readonly text: string }
  | { readonly show: 'hold'; readonly hold: Hold }
  | { readonly show: 'omit' }

/** Text, a HOLD to mark (review mode), the production fallback, or nothing. */
export function resolveHeld(v: Held, review: boolean = SHOW_HOLDS): Resolved {
  if (typeof v === 'string') return { show: 'text', text: v }
  if (review) return { show: 'hold', hold: v }
  return v.prodFallback !== null ? { show: 'text', text: v.prodFallback } : { show: 'omit' }
}

export type ResolvedClaim<T> =
  | {
      readonly show: 'value'
      readonly value: T
      readonly pending: boolean
      readonly id: string | null
    }
  | { readonly show: 'omit' }

/** A plain value, a confirmed claim, a pending claim (review mode only), or nothing. */
export function resolveClaim<T>(c: Confirm<T> | T, review: boolean = SHOW_HOLDS): ResolvedClaim<T> {
  if (!isConfirm(c)) return { show: 'value', value: c as T, pending: false, id: null }
  const k = c as Confirm<T>
  if (k.status === 'ok') return { show: 'value', value: k.value, pending: false, id: k.id }
  if (k.status === 'pending' && review)
    return { show: 'value', value: k.value, pending: true, id: k.id }
  return { show: 'omit' }
}

/** For JSON-LD, metadata and hrefs: a real value, or undefined. Never HOLD text and never fallbacks. */
export const fact = (v: Held): string | undefined => (typeof v === 'string' ? v : undefined)

/** For attributes that cannot hold a chip (aria-label, alt). */
export function heldText(v: Held, review: boolean = SHOW_HOLDS): string | undefined {
  const r = resolveHeld(v, review)
  return r.show === 'text' ? r.text : r.show === 'hold' ? `HOLD: ${r.hold.note}` : undefined
}

/** Every hold() and confirm() made so far, for /punch-list. */
export const holdRegistry = (): readonly (Hold | Confirm<unknown>)[] => [...registry.values()]
