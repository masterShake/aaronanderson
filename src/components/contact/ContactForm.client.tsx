'use client'
import {
  Suspense,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { issueFormToken, submitContact } from '@/app/contact/actions'
import {
  FIELDS,
  IDLE,
  NOT_SURE,
  asSheet,
  checkValues,
  type FieldError,
  type FieldName,
  type FormError,
  type Values,
} from '@/lib/contact/fields'
import s from './contact.module.css'

const TurnstileField = dynamic(() => import('./TurnstileField.client'), { ssr: false })

/** Re-issue the time token when it is older than this (it expires at two hours). */
const REISSUE_MS = 90 * 60_000
/** How long the preflight waits for a token or a Turnstile response. */
const TOKEN_WAIT_MS = 3_000
const TURNSTILE_WAIT_MS = 8_000

export interface ContactFormCopy {
  labels: Readonly<Record<FieldName, string>>
  optional: string
  hints: { email: string; company: string; message: string }
  notSure: string
  sheets: readonly { id: string; label: string }[]
  honeypot: string
  submit: string
  pending: string
  verifying: string
  errorSummary: string
  fieldErrors: {
    required: string
    email: string
    tooShort: ReactNode
    tooLongMessage: ReactNode
    tooLongShort: ReactNode
  }
  formErrors: Readonly<Record<FormError, string>>
  success: {
    title: string
    /** The body around the visitor's name, rendered on the server. */
    before: ReactNode
    after: ReactNode
    live: string
    sooner?: string
  }
}

export interface SuccessDrawingProps {
  src: string
  ourNode: string
  theirNode: string
  received: string
  /** Label positions, percent of the image box (top-left anchored). */
  at: { ours: [number, number]; theirs: [number, number]; stamp: [number, number] }
  aspect: [number, number]
}

const subscribe = () => () => {}
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

const MAX_NODE = 32
const truncate = (t: string) => (t.length > MAX_NODE ? `${t.slice(0, MAX_NODE - 1)}…` : t)

function SuccessDrawing({ d, company }: { d: SuccessDrawingProps; company: string }) {
  const pos = (p: [number, number]) => ({ left: `${p[0]}%`, top: `${p[1]}%` })
  return (
    <div
      className={s.success}
      aria-hidden="true"
      style={{ aspectRatio: `${d.aspect[0]} / ${d.aspect[1]}` }}
    >
      {/* a baked SVG still from /drawings: next/image adds nothing for it */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.src} alt="" className={s.successImg} />
      <span className={s.node} style={pos(d.at.ours)}>
        {d.ourNode}
      </span>
      <span className={`${s.node} ${s.theirs}`} style={pos(d.at.theirs)}>
        {truncate(company || d.theirNode)}
      </span>
      <span className={`stamp is-landing ${s.received}`} style={pos(d.at.stamp)}>
        {d.received}
      </span>
    </div>
  )
}

function SheetSelect({
  label,
  notSure,
  sheets,
  initial,
}: {
  label: string
  notSure: string
  sheets: ContactFormCopy['sheets']
  initial: string
}) {
  return (
    <div className={s.field}>
      <label htmlFor="f-sheet" className={s.label}>
        {label}
      </label>
      <select id="f-sheet" name="sheet" defaultValue={initial} className={s.control}>
        <option value={NOT_SURE}>{notSure}</option>
        {sheets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Reads ?sheet on the client; only this leaf bails out of the static render (C8). */
function SheetFromQuery(
  props: Omit<Parameters<typeof SheetSelect>[0], 'initial'> & { value?: string },
) {
  const q = asSheet(useSearchParams().get('sheet'))
  const initial = props.value || q || NOT_SURE
  return <SheetSelect key={initial} {...props} initial={initial} />
}

export function ContactForm({
  copy,
  limits,
  turnstileSiteKey,
  drawing,
}: {
  copy: ContactFormCopy
  limits: { min: number; max: number }
  turnstileSiteKey?: string
  drawing: SuccessDrawingProps
}) {
  const [state, formAction, pending] = useActionState(submitContact, IDLE)
  const hydrated = useHydrated()
  const values: Partial<Values> =
    state.status === 'invalid' || state.status === 'error' ? state.values : {}
  const [local, setLocal] = useState<{
    errors: Partial<Record<FieldName, FieldError>>
    n: number
  } | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [turnstileOn, setTurnstileOn] = useState(false)
  const [count, setCount] = useState(values.message?.length ?? 0)
  const summary = useRef<HTMLDivElement>(null)
  const tokenInput = useRef<HTMLInputElement>(null)
  const token = useRef<{ v: string; at: number } | null>(null)
  const inflight = useRef<Promise<string> | null>(null)
  const resubmit = useRef(false)
  const turnstile = useRef<TurnstileInstance | null>(null)

  const fetchToken = useCallback(() => {
    if (inflight.current) return inflight.current
    const p = issueFormToken()
      .then((v) => {
        token.current = v ? { v, at: Date.now() } : null
        return v
      })
      .catch(() => '')
      .finally(() => {
        inflight.current = null
      })
    inflight.current = p
    return p
  }, [])

  const onFocus = () => {
    const t = token.current
    if (!inflight.current && (!t || Date.now() - t.at > REISSUE_MS)) void fetchToken()
    if (turnstileSiteKey && !turnstileOn) setTurnstileOn(true)
  }

  // A server result: show its errors (dropping the client's), focus the summary,
  // or after a send drop the token, fetch a fresh one and reset Turnstile.
  const [seen, setSeen] = useState(state)
  if (seen !== state) {
    setSeen(state)
    setLocal(null)
    setCount(
      state.status === 'invalid' || state.status === 'error' ? state.values.message.length : 0,
    )
    if (state.status === 'invalid' || state.status === 'error') setFocusTick((n) => n + 1)
  }
  useEffect(() => {
    if (state.status === 'sent') {
      token.current = null
      void fetchToken()
      turnstile.current?.reset()
    } else if (state.status === 'error' && state.formError === 'turnstile') {
      turnstile.current?.reset()
    }
  }, [state, fetchToken])
  useEffect(() => {
    if (focusTick) summary.current?.focus()
  }, [focusTick])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    if (pending) {
      e.preventDefault()
      return
    }
    if (resubmit.current) {
      resubmit.current = false
      if (tokenInput.current) tokenInput.current.value = token.current?.v ?? ''
      return
    }
    const fd = new FormData(form)
    const v = Object.fromEntries(FIELDS.map((f) => [f, String(fd.get(f) ?? '')])) as Values
    const errors = checkValues(v, limits)
    if (Object.keys(errors).length) {
      e.preventDefault()
      setLocal((l) => ({ errors, n: (l?.n ?? 0) + 1 }))
      setFocusTick((n) => n + 1)
      return
    }
    setLocal(null)
    const needToken = !token.current
    const tsField = form.elements.namedItem('cf-turnstile-response') as HTMLInputElement | null
    const needTurnstile = Boolean(turnstileSiteKey) && !tsField?.value
    if (!needToken && !needTurnstile) {
      if (tokenInput.current) tokenInput.current.value = token.current?.v ?? ''
      return
    }
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    void (async () => {
      if (needToken)
        await Promise.race([fetchToken(), new Promise((r) => setTimeout(r, TOKEN_WAIT_MS))])
      if (needTurnstile) {
        if (!turnstileOn) setTurnstileOn(true)
        setVerifying(true)
        await new Promise((r) => setTimeout(r, 0))
        try {
          await turnstile.current?.getResponsePromise(TURNSTILE_WAIT_MS)
        } catch {
          // the server reports the failed check; the visitor presses Send again
        }
        setVerifying(false)
      }
      resubmit.current = true
      form.requestSubmit(submitter ?? undefined)
    })()
  }

  const errors: Partial<Record<FieldName, FieldError>> =
    local?.errors ?? (state.status === 'invalid' ? state.errors : {})
  const formError = !local && state.status === 'error' ? state.formError : null
  const failing = FIELDS.filter((f) => errors[f])
  const showSummary = failing.length > 0 || formError !== null

  const errorText = (f: FieldName, code: FieldError): ReactNode =>
    code === 'required'
      ? copy.fieldErrors.required
      : code === 'email'
        ? copy.fieldErrors.email
        : code === 'tooShort'
          ? copy.fieldErrors.tooShort
          : f === 'message'
            ? copy.fieldErrors.tooLongMessage
            : copy.fieldErrors.tooLongShort

  const describedBy = (f: FieldName, hint: boolean) =>
    [hint ? `f-${f}-hint` : '', errors[f] ? `f-${f}-err` : ''].filter(Boolean).join(' ') ||
    undefined

  const fieldShell = (f: FieldName, label: ReactNode, control: ReactNode, hint?: ReactNode) => (
    <div className={s.field} data-invalid={errors[f] ? '' : undefined}>
      <label htmlFor={`f-${f}`} className={s.label}>
        {label}
      </label>
      {hint ? (
        <p id={`f-${f}-hint`} className={s.hint}>
          {hint}
        </p>
      ) : null}
      {errors[f] ? (
        <p id={`f-${f}-err`} className={s.error}>
          {errorText(f, errors[f]!)}
        </p>
      ) : null}
      <span className={s.cloud}>{control}</span>
    </div>
  )

  const sent = state.status === 'sent' ? state : null

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onFocusCapture={onFocus}
      noValidate={hydrated}
      className={s.form}
    >
      {showSummary ? (
        <div
          id="form-errors"
          ref={summary}
          tabIndex={-1}
          aria-labelledby="form-errors-h"
          className={s.summary}
        >
          <h3 id="form-errors-h" className={s.summaryTitle}>
            {formError ? copy.formErrors[formError] : copy.errorSummary}
          </h3>
          {failing.length ? (
            <ul className={s.summaryList}>
              {failing.map((f) => (
                <li key={f}>
                  <a href={`#f-${f}`}>
                    {copy.labels[f]}: {errorText(f, errors[f]!)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {fieldShell(
        'name',
        copy.labels.name,
        <input
          id="f-name"
          name="name"
          autoComplete="name"
          required
          maxLength={200}
          defaultValue={values.name ?? ''}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name', false)}
          className={s.control}
        />,
      )}
      {fieldShell(
        'email',
        copy.labels.email,
        <input
          id="f-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={values.email ?? ''}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', true)}
          className={s.control}
        />,
        copy.hints.email,
      )}
      {fieldShell(
        'company',
        <>
          {copy.labels.company} <span className={s.optional}>{copy.optional}</span>
        </>,
        <input
          id="f-company"
          name="company"
          autoComplete="organization"
          maxLength={200}
          defaultValue={values.company ?? ''}
          aria-invalid={errors.company ? true : undefined}
          aria-describedby={describedBy('company', true)}
          className={s.control}
        />,
        copy.hints.company,
      )}
      <Suspense
        fallback={
          <SheetSelect
            label={copy.labels.sheet}
            notSure={copy.notSure}
            sheets={copy.sheets}
            initial={values.sheet || NOT_SURE}
          />
        }
      >
        <SheetFromQuery
          label={copy.labels.sheet}
          notSure={copy.notSure}
          sheets={copy.sheets}
          value={values.sheet}
        />
      </Suspense>
      {fieldShell(
        'message',
        copy.labels.message,
        <textarea
          id="f-message"
          name="message"
          rows={6}
          required
          minLength={limits.min}
          maxLength={limits.max + 200}
          defaultValue={values.message ?? ''}
          onChange={(e) => setCount(e.currentTarget.value.length)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message', true)}
          className={`${s.control} ${s.textarea}`}
        />,
        copy.hints.message,
      )}
      <p className={s.counter} aria-hidden="true" data-over={count > limits.max ? '' : undefined}>
        {count} / {limits.max}
      </p>

      <div className={s.hp} inert aria-hidden="true">
        <label htmlFor="extra_notes">{copy.honeypot}</label>
        <input
          id="extra_notes"
          name="extra_notes"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
          data-form-type="other"
        />
      </div>
      <input type="hidden" name="ae_t" ref={tokenInput} defaultValue="" />
      {turnstileOn && turnstileSiteKey ? (
        <TurnstileField siteKey={turnstileSiteKey} instance={turnstile} />
      ) : null}

      <div className={s.actions}>
        <button
          type="submit"
          className={s.submit}
          aria-disabled={pending || verifying ? true : undefined}
        >
          {pending ? copy.pending : copy.submit}
        </button>
        <p className={s.status} aria-live="polite">
          {verifying ? copy.verifying : ''}
        </p>
      </div>

      <div role="status" aria-live="polite" className={s.sent}>
        {sent ? (
          <>
            <p className={s.sentTitle}>{copy.success.title}</p>
            <p>
              {copy.success.before}
              {sent.name}
              {copy.success.after}
            </p>
            <SuccessDrawing d={drawing} company={sent.company} />
            <p className={s.sentLive}>{copy.success.live}</p>
            {copy.success.sooner ? (
              <p>
                <a href="#book">{copy.success.sooner}</a>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </form>
  )
}
