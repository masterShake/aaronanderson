'use client'
import { useState } from 'react'
import s from './ui.module.css'

export interface CopyEmailProps {
  email: string
  copy: string
  copied: string
  live: string
  failed?: string
}

/** The address as a mailto link, plus a Copy button that announces the result. */
export function CopyEmail({ email, copy, copied, live, failed }: CopyEmailProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <span>
      <a href={`mailto:${email}`}>{email}</a>{' '}
      <button type="button" className={`${s.button} ${s.secondary}`} onClick={onCopy}>
        {state === 'copied' ? copied : copy}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? live : state === 'failed' ? (failed ?? '') : ''}
      </span>
    </span>
  )
}
