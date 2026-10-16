import { contact, contactUi } from '@/content/pages/contact'
import { services } from '@/content/services'
import type { Scheduler } from '@/lib/scheduler'
import { RichText } from '@/components/ui/RichText'
import { SchedulerFacade } from '@/components/contact/SchedulerFacade.client'
import { plain } from './rich'

type CalScheduler = Extract<Scheduler, { provider: 'cal' }>

/**
 * The Cal.com facade with its strings rendered here, on the server (C3). It also gets the
 * sheet id → service name map and the notes template: on "Show available times" it reads
 * ?sheet and, when the sheet resolves, prefills the booking notes.
 */
export function BookFacade({ scheduler }: { scheduler: CalScheduler }) {
  const f = contact.book.facade
  return (
    <SchedulerFacade
      scheduler={{
        bookingUrl: scheduler.bookingUrl,
        calLink: scheduler.calLink,
        namespace: scheduler.namespace,
        calOrigin: scheduler.calOrigin,
        embedJsUrl: scheduler.embedJsUrl,
        preconnect: scheduler.preconnect,
      }}
      copy={{
        show: f.show,
        note: <RichText value={f.note} />,
        newTab: f.newTab,
        loading: f.loading,
        loaded: f.loaded,
        slow: <RichText value={f.slow} />,
        failed: <RichText value={f.failed} />,
        booked: <RichText value={f.booked} />,
        slowText: plain(f.slow),
        failedText: plain(f.failed),
        bookedText: plain(f.booked),
        region: f.region,
        weekdays: contactUi.weekdays,
      }}
      notes={{
        sheets: Object.fromEntries(services.map((sv) => [sv.id, sv.name])),
        template: contact.bookingNotes,
      }}
    />
  )
}
