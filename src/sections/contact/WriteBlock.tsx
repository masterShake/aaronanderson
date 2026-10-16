import { WriteSection } from './WriteSection'
import { EmailSection } from './EmailSection'
import { Privacy } from './Privacy'
import s from './contact-sections.module.css'

/**
 * The form with its side notes (pages-drawings §2.5): from 1024 px the form
 * takes cols 1–7 and the notes cols 9–12 beside it (the email address when it
 * is set, then what we do with your details), so no column is left empty.
 * Below 1024 px they stack, form first. Each part stays its own section.
 */
export function WriteBlock() {
  return (
    <div className={`wrap ${s.writeBlock}`}>
      <WriteSection className={s.writeMain} />
      <div className={s.writeNotes}>
        <EmailSection className={s.note} />
        <Privacy className={s.note} />
      </div>
    </div>
  )
}
