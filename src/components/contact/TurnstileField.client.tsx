'use client'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

/**
 * Cloudflare Turnstile, interaction-only (research §3.3). Loaded with
 * next/dynamic on the form's first focus, and only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Compact below 320 px so the 300 px
 * minimum never breaks reflow.
 */
export default function TurnstileField({
  siteKey,
  instance,
}: {
  siteKey: string
  instance: RefObject<TurnstileInstance | null>
}) {
  const box = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    setCompact((box.current?.clientWidth ?? 400) < 320)
  }, [])
  return (
    <div ref={box}>
      <Turnstile
        ref={instance}
        siteKey={siteKey}
        options={{
          action: 'contact',
          appearance: 'interaction-only',
          theme: 'light',
          size: compact ? 'compact' : 'flexible',
          responseFieldName: 'cf-turnstile-response',
        }}
      />
    </div>
  )
}
