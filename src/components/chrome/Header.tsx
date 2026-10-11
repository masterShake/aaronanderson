import Link from 'next/link'
import { site } from '@/content/site'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { NavLinks } from './NavLinks.client'
import { SheetChip } from './SheetChip.client'
import { MenuDialog } from './MenuDialog'
import { Wordmark } from './Wordmark'
import s from './chrome.module.css'

/** The sticky header. Never given a view-transition-name, so it stays clickable during a sheet change. */
export function Header() {
  return (
    <header className={s.header}>
      <div className={`${s.bar} wrap`}>
        <Link href="/" className={s.brand} aria-label={site.header.home}>
          <Wordmark size="header" />
          <SheetChip items={site.nav} />
        </Link>
        <div className={s.wide}>
          <nav aria-label={site.header.navLabel} className={s.nav}>
            <NavLinks items={site.nav} variant="bar" />
          </nav>
          <MotionSwitch variant="header" label={site.motion.label} />
        </div>
        <BookCallButton />
        <div className={s.narrow}>
          <MenuDialog />
        </div>
      </div>
    </header>
  )
}
