'use client'
import { useEffect, useRef } from 'react'
import Cal, { getCalApi } from '@calcom/embed-react'

/**
 * The Cal.com inline embed (pages-drawings §8.3), loaded with next/dynamic
 * (ssr: false) only after "Show available times". Brand variables are
 * asphalt, never orange (orange marks fall to 2.55:1 on paper). Never
 * rendered with an empty calLink: <Cal> throws on it.
 */

export interface CalInlineProps {
  calLink: string
  namespace: string
  calOrigin: string
  embedJsUrl: string
  onReady: () => void
  onFailed: () => void
  onBooked: () => void
  /** Prefills Cal.com's "Additional notes" (the `notes` booking field); left out when unset. */
  notes?: string
}

const BRAND = {
  'cal-brand': '#2A2C2E',
  'cal-brand-emphasis': '#1F2123',
  'cal-brand-text': '#F4F2EC',
  'cal-bg': '#F4F2EC',
  'cal-text': '#2A2C2E',
  'cal-border-booker': '#6E7378',
}

type Api = (method: string, arg: unknown) => void

export default function CalInline({
  calLink,
  namespace,
  calOrigin,
  embedJsUrl,
  onReady,
  onFailed,
  onBooked,
  notes,
}: CalInlineProps) {
  const cbs = useRef({ onReady, onFailed, onBooked })
  useEffect(() => {
    cbs.current = { onReady, onFailed, onBooked }
  }, [onReady, onFailed, onBooked])

  useEffect(() => {
    let off = false
    // getCalApi adds embed.js synchronously, so the script exists right after the call
    const ready = getCalApi({ namespace, embedJsUrl })
    // a blocked or failed embed.js never fires linkFailed: watch the script itself
    const script = document.querySelector<HTMLScriptElement>(`script[src="${embedJsUrl}"]`)
    const onError = () => cbs.current.onFailed()
    script?.addEventListener('error', onError)
    void ready.then((api) => {
      if (off) return
      const cal = api as unknown as Api
      cal('ui', {
        theme: 'light',
        layout: 'month_view',
        hideEventTypeDetails: false,
        cssVarsPerTheme: { light: BRAND, dark: BRAND },
      })
      cal('on', { action: 'linkReady', callback: () => cbs.current.onReady() })
      cal('on', { action: 'linkFailed', callback: () => cbs.current.onFailed() })
      cal('on', { action: 'bookingSuccessfulV2', callback: () => cbs.current.onBooked() })
    })
    return () => {
      off = true
      script?.removeEventListener('error', onError)
    }
  }, [namespace, embedJsUrl])

  return (
    <Cal
      namespace={namespace}
      calLink={calLink}
      calOrigin={calOrigin}
      embedJsUrl={embedJsUrl}
      // config keys reach the booking page as query params; a booking field prefills from its name
      config={{ layout: 'month_view', theme: 'light', ...(notes ? { notes } : {}) }}
      style={{ width: '100%', minHeight: '100%' }}
    />
  )
}
