import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { Href } from '@/content/types'
import s from './ui.module.css'

export interface ButtonProps {
  /** 'book' (orange) is reserved for Book a call. */
  variant: 'book' | 'secondary' | 'text'
  href?: Href
  type?: 'button' | 'submit'
  size?: 'md' | 'lg'
  className?: string
  children: ReactNode
}

/** A button, or a link styled as one when href is given. */
export function Button({
  variant,
  href,
  type = 'button',
  size = 'md',
  className,
  children,
}: ButtonProps) {
  const cls = [s.button, s[variant], size === 'lg' ? s.lg : '', className ?? ''].join(' ').trim()
  if (href) {
    return href.startsWith('/') ? (
      <Link href={href as Route} className={cls}>
        {children}
      </Link>
    ) : (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={cls}>
      {children}
    </button>
  )
}
