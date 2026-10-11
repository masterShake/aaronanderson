import { z } from 'zod'
import {
  FIELDS,
  LIMITS,
  NOT_SURE,
  SHEET_IDS,
  type FieldError,
  type FieldName,
  type Values,
} from './fields'

/**
 * The server's validation (pages-drawings §8.2 step 2). z.object strips the
 * injected $ACTION_* keys; never strictObject. Errors map to content keys.
 */

export function contactSchema(message: { min: number; max: number }) {
  return z.object({
    name: z.string().trim().min(1, 'required').max(LIMITS.name, 'tooLong'),
    email: z.string().trim().min(1, 'required').max(LIMITS.email, 'email').pipe(z.email('email')),
    company: z.string().trim().max(LIMITS.company, 'tooLong'),
    sheet: z.enum([NOT_SURE, ...SHEET_IDS]).catch(NOT_SURE),
    message: z
      .string()
      .trim()
      .min(1, 'required')
      .min(message.min, 'tooShort')
      .max(message.max, 'tooLong'),
    extra_notes: z.string().optional(),
    ae_t: z.string().optional(),
    'cf-turnstile-response': z.string().optional(),
  })
}

export type ContactInput = z.infer<ReturnType<typeof contactSchema>>

const str = (v: FormDataEntryValue | undefined) => (typeof v === 'string' ? v : '')

/** Trimmed strings for every field, to send back with an error. */
export function valuesFrom(raw: Record<string, FormDataEntryValue>): Values {
  const v = {} as Values
  for (const f of FIELDS) v[f] = str(raw[f]).trim()
  return v
}

const CODES: readonly FieldError[] = ['required', 'email', 'tooShort', 'tooLong']

export type Parsed =
  { ok: true; data: ContactInput } | { ok: false; errors: Partial<Record<FieldName, FieldError>> }

export function parseContact(
  raw: Record<string, FormDataEntryValue>,
  message: { min: number; max: number },
): Parsed {
  const input: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') input[k] = v
  for (const f of FIELDS) input[f] ??= ''
  const r = contactSchema(message).safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  const flat = z.flattenError(r.error).fieldErrors as Partial<Record<string, string[]>>
  const errors: Partial<Record<FieldName, FieldError>> = {}
  for (const f of FIELDS) {
    const first = flat[f]?.find((m) => (CODES as readonly string[]).includes(m))
    if (flat[f]?.length) errors[f] = (first as FieldError | undefined) ?? 'required'
  }
  return { ok: false, errors }
}
