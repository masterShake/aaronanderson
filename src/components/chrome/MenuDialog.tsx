import { site } from '@/content/site'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { NavLinks } from './NavLinks.client'
import s from './chrome.module.css'

/**
 * The mobile menu: a non-modal popover opened by the Menu button, so it works
 * before hydration. Esc and light dismiss close it; focus returns to Menu.
 */
export function MenuDialog({ id = 'site-menu' }: { id?: 'site-menu' }) {
  return (
    <>
      <button type="button" className={s.menuButton} popoverTarget={id}>
        {site.header.menu}
      </button>
      <div
        id={id}
        popover="auto"
        className={s.menu}
        role="dialog"
        aria-label={site.header.menuTitle}
      >
        <nav aria-label={site.header.menuTitle} className={s.nav}>
          <NavLinks items={site.nav} variant="menu" />
        </nav>
        <MotionSwitch variant="menu" label={site.motion.label} />
        <button
          type="button"
          className={s.menuButton}
          popoverTarget={id}
          popoverTargetAction="hide"
        >
          {site.header.close}
        </button>
      </div>
    </>
  )
}
