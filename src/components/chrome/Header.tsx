import Link from 'next/link'
import { site } from '@/content/site'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { NavLinks } from './NavLinks.client'
import { SheetChip } from './SheetChip.client'
import { MenuDialog } from './MenuDialog'
import { Wordmark } from './Wordmark'
import s from './chrome.module.css'

/**
 * The sticky header (D1). Desktop: wordmark and sheet chip, the five sheets,
 * the motion switch and Book a call. Below 1024 px: wordmark, Book a call and
 * Menu. Never given a view-transition-name, so it stays clickable while a
 * sheet prints.
 */
export function Header() {
  return (
    <header className={s.header}>
      <div className={`${s.bar} wrap`}>
        <Link href="/" className={s.brand} aria-label={site.header.home}>
          <Wordmark size="header" mark />
          <SheetChip items={site.nav} />
        </Link>
        <nav aria-label={site.header.navLabel} className={s.wide}>
          <NavLinks items={site.nav} variant="bar" />
        </nav>
        <div className={s.wide}>
          <MotionSwitch variant="header" label={site.motion.label} />
        </div>
        <BookCallButton className={s.book} />
        <div className={s.narrow}>
          <MenuDialog />
        </div>
      </div>
    </header>
  )
}
