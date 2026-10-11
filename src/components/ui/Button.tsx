import type { ReactNode } from 'react'
import type { Route } from 'next'
import type { Href } from '@/content/types'
import { IntentLink } from './IntentLink.client'
import s from './ui.module.css'

export interface ButtonProps {
  /** 'book' (orange fill, asphalt text) is reserved for Book a call. */
  variant: 'book' | 'secondary' | 'text'
  href?: Href
  type?: 'button' | 'submit'
  size?: 'md' | 'lg'
  className?: string
  children: ReactNode
}

/**
 * A button, or a link styled as one when href is given. At least 44 px tall;
 * CAD corner grips mark keyboard focus.
 */
export function Button({
  variant,
  href,
  type = 'button',
  size = 'md',
  className,
  children,
}: ButtonProps) {
  const cls = [s.button, s[variant], size === 'lg' ? s.lg : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  if (href) {
    return href.startsWith('/') ? (
      <IntentLink href={href as Route} className={cls} data-variant={variant}>
        {children}
      </IntentLink>
    ) : (
      <a href={href} className={cls} data-variant={variant}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={cls} data-variant={variant}>
      {children}
    </button>
  )
}
