/**
 * The contact form's field names, limits and result shape, shared by the
 * client form and the server action. No imports: the client bundle reads it.
 */

export type FieldName = 'name' | 'email' | 'company' | 'sheet' | 'message'
export const FIELDS: readonly FieldName[] = ['name', 'email', 'company', 'sheet', 'message']

/** Must equal services[].id (a unit test checks it); talkHref links use them as ?sheet=. */
export const SHEET_IDS = ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'] as const
export type SheetId = (typeof SHEET_IDS)[number]
export const NOT_SURE = 'not-sure'

export const LIMITS = {
  name: 120,
  company: 120,
  email: 254,
} as const

export type FieldError = 'required' | 'email' | 'tooShort' | 'tooLong'
export type FormError = 'rate_limited' | 'turnstile' | 'send_failed' | 'not_configured'
export type Values = Record<FieldName, string>

export type ContactState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: Partial<Record<FieldName, FieldError>>; values: Values }
  | { status: 'error'; formError: FormError; values: Values }
  | { status: 'sent'; name: string; company: string; at: number }

export const IDLE: ContactState = { status: 'idle' }

export const asSheet = (v: string | null | undefined): SheetId | null => {
  const u = (v ?? '').trim().toUpperCase()
  return (SHEET_IDS as readonly string[]).includes(u) ? (u as SheetId) : null
}

/** A plain, permissive address check (the server's zod check is the authority). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The same rules the server applies, for the client's preflight: required
 * name, email and message; the message between min and max characters.
 */
export function checkValues(
  v: Values,
  message: { min: number; max: number },
): Partial<Record<FieldName, FieldError>> {
  const e: Partial<Record<FieldName, FieldError>> = {}
  const name = v.name.trim()
  const email = v.email.trim()
  const msg = v.message.trim()
  if (!name) e.name = 'required'
  else if (name.length > LIMITS.name) e.name = 'tooLong'
  if (!email) e.email = 'required'
  else if (email.length > LIMITS.email || !EMAIL.test(email)) e.email = 'email'
  if (v.company.trim().length > LIMITS.company) e.company = 'tooLong'
  if (!msg) e.message = 'required'
  else if (msg.length < message.min) e.message = 'tooShort'
  else if (msg.length > message.max) e.message = 'tooLong'
  return e
}
