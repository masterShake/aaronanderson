'use client'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { LOAD } from '@/motion/timing/global'
import { bookingNotes } from '@/lib/contact/booking'
import s from './contact.module.css'

const CalInline = dynamic(() => import('./CalInline.client'), { ssr: false })

/**
 * The booking facade (pages-drawings §8.3): a drawn month grid and "Show
 * available times". Cal.com loads only on that click (scheduler.autoload is
 * false). States: idle, loading, ready, slow (after LOAD.schedulerSlow it
 * points to the form and keeps waiting), failed and booked, each read out by
 * the always-present status line. Before hydration the button is a link to
 * the booking page. Strings arrive as props (C3): no @/content here.
 */

export interface FacadeScheduler {
  bookingUrl: string
  calLink: string
  namespace: string
  calOrigin: string
  embedJsUrl: string
  preconnect: readonly string[]
}

export interface FacadeCopy {
  show: string
  note: ReactNode
  newTab: string
  loading: string
  loaded: string
  slow: ReactNode
  failed: ReactNode
  booked: ReactNode
  /** Plain-text versions for the status line. */
  slowText: string
  failedText: string
  bookedText: string
  region: string
  weekdays: readonly string[]
}

export type FacadePhase = 'idle' | 'loading' | 'ready' | 'slow' | 'failed' | 'booked'

const subscribe = () => () => {}
const CELLS = 42

/** Booking notes from ?sheet: the sheet id → service name map and the "About {sheet} · {serviceName}" template. */
export interface FacadeNotes {
  sheets: Readonly<Record<string, string>>
  template: string
}

export function SchedulerFacade({
  scheduler,
  copy,
  notes: notesFrom,
}: {
  scheduler: FacadeScheduler
  copy: FacadeCopy
  notes?: FacadeNotes
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [phase, setPhase] = useState<FacadePhase>('idle')
  // read at click time from the address bar, so the page itself stays static
  const [notes, setNotes] = useState<string | null>(null)
  const region = useRef<HTMLDivElement>(null)
  const preconnected = useRef(false)

  const preconnect = () => {
    if (preconnected.current) return
    preconnected.current = true
    for (const href of scheduler.preconnect) {
      const l = document.createElement('link')
      l.rel = 'preconnect'
      l.href = href
      document.head.append(l)
    }
  }

  const onReady = useCallback(() => setPhase((p) => (p === 'booked' ? p : 'ready')), [])
  const onFailed = useCallback(() => setPhase((p) => (p === 'booked' ? p : 'failed')), [])
  const onBooked = useCallback(() => setPhase('booked'), [])

  useEffect(() => {
    if (phase !== 'loading') return
    region.current?.focus()
    const t = setTimeout(() => setPhase((p) => (p === 'loading' ? 'slow' : p)), LOAD.schedulerSlow)
    return () => clearTimeout(t)
  }, [phase])

  const mounted = phase !== 'idle'
  const status =
    phase === 'loading'
      ? copy.loading
      : phase === 'ready'
        ? copy.loaded
        : phase === 'slow'
          ? copy.slowText
          : phase === 'failed'
            ? copy.failedText
            : phase === 'booked'
              ? copy.bookedText
              : ''
  const visibleNote =
    phase === 'slow'
      ? copy.slow
      : phase === 'failed'
        ? copy.failed
        : phase === 'booked'
          ? copy.booked
          : null

  return (
    <div className={s.facade} data-facade={phase}>
      <div className={s.bookBox}>
        <div className={s.grid} aria-hidden="true">
          {copy.weekdays.map((d, i) => (
            <span key={i} className={s.day}>
              {d}
            </span>
          ))}
          {Array.from({ length: CELLS }, (_, i) => (
            <span key={i} className={s.cell} />
          ))}
        </div>
        {mounted ? (
          <div
            ref={region}
            role="region"
            aria-label={copy.region}
            tabIndex={-1}
            aria-busy={phase === 'loading' || phase === 'slow'}
            className={s.region}
          >
            {phase === 'loading' || phase === 'slow' ? (
              <span className={s.queue} aria-hidden="true" />
            ) : null}
            <CalInline
              calLink={scheduler.calLink}
              namespace={scheduler.namespace}
              calOrigin={scheduler.calOrigin}
              embedJsUrl={scheduler.embedJsUrl}
              onReady={onReady}
              onFailed={onFailed}
              onBooked={onBooked}
              notes={notes ?? undefined}
            />
          </div>
        ) : (
          <div className={s.idle}>
            {hydrated ? (
              <button
                type="button"
                className={s.show}
                aria-describedby="book-note"
                onPointerEnter={preconnect}
                onFocus={preconnect}
                onClick={() => {
                  preconnect()
                  if (notesFrom)
                    setNotes(
                      bookingNotes(window.location.search, notesFrom.sheets, notesFrom.template),
                    )
                  setPhase('loading')
                }}
              >
                {copy.show}
              </button>
            ) : (
              <a
                href={scheduler.bookingUrl}
                className={s.show}
                aria-describedby="book-note"
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.show}
              </a>
            )}
            <div id="book-note">{copy.note}</div>
          </div>
        )}
      </div>
      {visibleNote ? <div className={s.note}>{visibleNote}</div> : null}
      <p className={s.newTab}>
        <a href={scheduler.bookingUrl} target="_blank" rel="noopener noreferrer">
          {copy.newTab}
        </a>
      </p>
      <p role="status" className="sr-only" data-facade-status="">
        {status}
      </p>
    </div>
  )
}
