'use client'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/content/types'
import s from './chrome.module.css'

/** The current sheet number, read from the pathname, as a boxed chip next to the wordmark. */
export function SheetChip({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()
  const current = items.find((it) => it.href === pathname)
  if (!current) return null
  return (
    <span className={s.chip} data-sheet={current.sheet}>
      {current.sheet}
    </span>
  )
}
