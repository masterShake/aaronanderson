'use client'
import { useEffect, useState } from 'react'
import { DUR } from '@/motion/timing/global'
import s from './ui.module.css'

export interface CopyEmailProps {
  email: string
  copy: string
  copied: string
  live: string
  failed?: string
}

/**
 * The address as a mailto link, plus a Copy button. The button reads "Copied"
 * for a moment; a polite live region announces success or failure. Without
 * JS the address is still a link and plain, selectable text.
 */
export function CopyEmail({ email, copy, copied, live, failed }: CopyEmailProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state !== 'copied') return
    const t = setTimeout(() => setState('idle'), DUR.copied)
    return () => clearTimeout(t)
  }, [state])
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <span className={s.copy}>
      <a href={`mailto:${email}`}>{email}</a>
      <button
        type="button"
        className={`${s.button} ${s.secondary}`}
        onClick={onCopy}
        data-state={state}
      >
        {state === 'copied' ? copied : copy}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? live : state === 'failed' ? (failed ?? '') : ''}
      </span>
    </span>
  )
}
