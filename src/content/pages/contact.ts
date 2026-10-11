import { confirm, hold } from '../hold'
import type { ContactContent } from '../types'

/** Contact, sheet G-03 (request for information). */
export const contact: ContactContent = {
  h1: 'Pick a time. Bring the spreadsheet.',
  deck: {
    text: "A {callLength} call with the people who'd do the work. No pitch deck: tell us where the retyping happens and we'll tell you what we'd look at first.",
    vars: {},
  },
  book: {
    id: 'book',
    h2: 'Open slots, straight from our calendar',
    facade: {
      show: 'Show available times',
      note: 'The calendar loads from Cal.com when you ask for it.',
      newTab: 'Open the calendar in a new tab',
      loading: 'Loading the calendar…',
      loaded: 'Calendar ready.',
      slow: 'The calendar is taking a while. The form below reaches the same people.',
      failed: "The calendar didn't load. Use the form below instead.",
      booked: "Booked. You'll get a confirmation email from Cal.com.",
      region: 'Booking calendar',
    },
    holdNote: 'The booking calendar goes here once the Cal.com link is in.',
  },
  form: {
    id: 'write',
    h2: 'Rather write it down?',
    headingNoScheduler: 'Tell us what is being retyped',
    intro: 'A few lines is plenty. We read every one.',
    fields: {
      name: { label: 'Your name' },
      email: { label: 'Work email' },
      company: { label: 'Company', optional: '(optional)' },
      sheet: { label: 'Which sheet?', notSure: 'Not sure yet' },
      message: {
        label: "What's being retyped?",
        hint: 'Which tools, who does it, how often.',
        min: 20,
        max: 2000,
      },
    },
    honeypot: 'Leave this empty',
    submit: 'Send it',
    pending: 'Sending…',
    errorSummary: 'A few things need fixing before this can go.',
    errors: {
      required: 'This one is needed.',
      email: 'That email address looks off.',
      tooShort: { text: 'Write at least {min} characters.', vars: {} },
      tooLong: { text: 'Keep it under {max} characters.', vars: {} },
      verify: 'The spam check failed. Try again, or email us instead.',
      rateLimited: 'Too many messages from here. Try again in a little while.',
      server: 'Something went wrong on our side. Your message was not sent.',
      expired: 'This form sat open too long. Send it again.',
      notConfigured: 'The form is not switched on yet. Email us instead.',
    },
    success: {
      title: 'Sent.',
      body: 'Your node joins ours. We read it and reply by email.',
      live: 'Sent. Your node joins ours.',
    },
    noScript: 'The form works without JavaScript; the spam check is a little stricter.',
  },
  email: {
    id: 'email',
    h2: 'Or just email',
    copy: 'Copy',
    copied: 'Copied',
    copiedLive: 'Email address copied.',
    copyFailed: 'Could not copy. Select the address instead.',
  },
  next: {
    id: 'next',
    h2: 'What happens after you reach out',
    steps: [
      'You book a time or write to us.',
      { text: 'We reply {replyTime}.', vars: {} },
      { text: 'A {callLength} call with the people who would do the work.', vars: {} },
      'A short written next step, often a fixed-fee survey proposal. No obligation either way.',
    ],
  },
  privacy: {
    id: 'privacy',
    h2: 'What we do with your details',
    body: [
      'We use what you send to reply to you.',
      confirm("We don't sell it or add you to a mailing list.", { id: 'claim.privacy.noSale' }),
    ],
    processors: [
      { name: 'Resend', does: 'delivers the messages' },
      { name: 'Cal.com', does: 'runs the calendar' },
      { name: 'Cloudflare Turnstile', does: 'checks for spam' },
    ],
    retention: hold('Retention period and the deletion contact', {
      id: 'contact.retention',
      kind: 'policy',
      prodFallback: null,
    }),
  },
  closing: {
    id: 'call',
    h2: 'Ready when you are.',
    body: 'Pick a slot above, or write to us and we will find one.',
  },
}
