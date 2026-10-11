'use client'
import { usePathname } from 'next/navigation'
import type { MouseEvent } from 'react'
import type { NavItem } from '@/content/types'
import { transitionTypes } from '@/lib/routes'
import { IntentLink } from '@/components/ui/IntentLink.client'
import s from './chrome.module.css'

/** Closes the menu popover after a sheet is picked (a soft navigation never light-dismisses it). */
function closeMenu(e: MouseEvent<HTMLAnchorElement>) {
  const pop = e.currentTarget.closest<HTMLElement>('[popover]')
  if (pop?.matches(':popover-open')) pop.hidePopover()
}

/**
 * The five sheets, in reading order, plain label first. The current one gets
 * aria-current="page" and a dimension-line underline with end ticks. In the
 * menu each row also shows its sheet number and title, and the first link
 * carries autofocus (the popover focuses it when it opens).
 */
export function NavLinks({
  items,
  variant,
}: {
  items: readonly NavItem[]
  variant: 'bar' | 'menu'
}) {
  const pathname = usePathname()
  const menu = variant === 'menu'
  return (
    <ul className={menu ? s.menuList : s.barList} data-variant={variant}>
      {items.map((it, i) => (
        <li key={it.page}>
          <IntentLink
            href={it.href}
            className={s.navLink}
            aria-current={pathname === it.href ? 'page' : undefined}
            transitionTypes={transitionTypes(pathname, it.href)}
            {...(menu ? { onClick: closeMenu, autoFocus: i === 0 } : {})}
          >
            <span className={s.navLabel}>{it.label}</span>
            {menu ? (
              <span className={s.navSheet}>
                {it.sheet} · {it.sheetTitle}
              </span>
            ) : null}
          </IntentLink>
        </li>
      ))}
    </ul>
  )
}
