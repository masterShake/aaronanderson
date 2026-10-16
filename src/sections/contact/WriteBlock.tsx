import { AfterContactFigure } from '@/figures/after-contact/AfterContactFigure'
import { WriteSection } from './WriteSection'
import { EmailSection } from './EmailSection'
import { NextSteps } from './NextSteps'
import { Privacy } from './Privacy'
import { noScheduler } from './scheduler'
import s from './contact-sections.module.css'

/**
 * The form with its side notes (pages-drawings §2.5, W4b R1). From 1024 px the
 * form takes the left column (7 parts) and the notes the right (5 parts): the
 * email address when it is set, what happens after you reach out (the four
 * steps as a column) and what we do with your details. The four-node
 * schematic then runs the full width under both. Below 1024 px everything
 * stacks in reading order, the schematic straight after the steps. Each part
 * stays its own section; the schematic is the steps' figure.
 */
export function WriteBlock() {
  return (
    <div className={`wrap ${s.writeBlock}`}>
      <WriteSection className={s.writeMain} />
      <EmailSection className={s.note} />
      <NextSteps className={s.note} aside />
      <div className={s.afterFigure}>
        <AfterContactFigure noScheduler={noScheduler} />
      </div>
      <Privacy className={s.note} />
    </div>
  )
}
