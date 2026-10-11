import { site } from '@/content/site'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { NavLinks } from './NavLinks.client'
import s from './chrome.module.css'

/**
 * The mobile menu: a <dialog popover="auto"> opened by the Menu button's
 * popovertarget, so it works before hydration and with JS off. It is not
 * modal (critic 20): Esc and light dismiss close it, the browser returns focus
 * to Menu, and the first sheet link carries autofocus. The dialog follows the
 * button in DOM order.
 */
export function MenuDialog({ id = 'site-menu' }: { id?: 'site-menu' }) {
  return (
    <>
      <button
        type="button"
        className={s.menuButton}
        popoverTarget={id}
        aria-controls={id}
        data-menu-button=""
      >
        {site.header.menu}
      </button>
      <dialog id={id} popover="auto" className={s.menu} aria-labelledby={`${id}-title`}>
        <div className={s.menuHead}>
          <p id={`${id}-title`} className={s.menuTitle}>
            {site.header.menuTitle}
          </p>
          <button
            type="button"
            className={s.menuButton}
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            {site.header.close}
          </button>
        </div>
        <nav aria-label={site.header.navLabel} className={s.menuNav}>
          <NavLinks items={site.nav} variant="menu" />
        </nav>
        <div className={s.menuFoot}>
          <MotionSwitch variant="menu" label={site.motion.label} />
        </div>
      </dialog>
    </>
  )
}
