import { contact } from '@/content/pages/contact'
import { CtaBand } from '@/components/blueprint/CtaBand'
import { noScheduler } from './scheduler'

export function ContactClosing() {
  const { bodyNoScheduler, ...band } = contact.closing
  return <CtaBand content={noScheduler ? { ...band, body: bodyNoScheduler } : band} />
}
