import { confirm, hold } from '../hold'
import { site } from '../site'
import type { ContactContent } from '../types'

const retention = hold('How long messages are kept, e.g. twelve months', {
  id: 'contact.retention',
  kind: 'policy',
  prodFallback: null,
})

/**
 * Contact, sheet G-03 (request for information). Every {callLength} and
 * {replyTime} sentence reads right with the production fallbacks ("short",
 * "by email"). Render-time vars: {name} (success), {min} and {max} (errors).
 */
export const contact: ContactContent = {
  h1: 'Pick a time. Bring the spreadsheet.',
  deck: {
    text: "A {callLength} call with the people who'd do the work. No pitch deck: tell us where the retyping happens and we'll tell you what we'd look at first.",
    vars: {},
  },
  book: {
    id: 'book',
    h2: 'Open slots, straight from our calendar',
    body: ['Bring whatever gets retyped most: a spreadsheet, a form, a weekly report.'],
    facade: {
      show: 'Show available times',
      note: "This loads Cal.com's calendar, which sets its own cookies.",
      newTab: 'Open the calendar in a new tab ↗',
      loading: 'Loading the booking calendar…',
      loaded: 'Booking calendar loaded.',
      slow: 'Still loading. Open it in a new tab, or use the form below.',
      failed: "The calendar didn't load. Try the new-tab link, or write to us below.",
      booked: 'Booked. Check your email for the invite.',
      region: 'Booking calendar',
    },
    holdNote: 'The booking calendar goes here once the Cal.com link is added.',
  },
  form: {
    id: 'write',
    h2: 'Rather write it down?',
    headingNoScheduler: "Tell us what's being retyped.",
    intro: 'A few lines is plenty.',
    fields: {
      name: { label: 'Your name' },
      email: { label: 'Email', hint: 'We reply to this address.' },
      company: {
        label: 'Company',
        optional: '(optional)',
        hint: 'Shown on your node when you send this.',
      },
      sheet: { label: 'Which sheet?', notSure: 'Not sure yet' },
      message: {
        label: "What's being retyped?",
        hint: 'A sentence or two: which tools, who retypes, how often.',
        min: 20,
        max: 2000,
      },
    },
    honeypot: 'Leave this field empty',
    submit: 'Send it',
    pending: 'Sending…',
    errorSummary: "There's a problem. Fix the fields below, then send again.",
    errors: {
      required: 'This one is needed.',
      email: 'That email address looks off.',
      tooShort: { text: 'Write at least {min} characters.', vars: {} },
      tooLong: { text: 'Keep it under {max} characters.', vars: {} },
      verify: "The spam check didn't finish. Press Send again.",
      rateLimited:
        'Too many messages from this connection. Try again later, or use the email address on this page.',
      server: "That didn't send. Your message is still here. Try again, or email us instead.",
      expired: 'This form sat open too long. Press Send again.',
      notConfigured: "The form isn't switched on yet. Please email us instead.",
    },
    success: {
      title: 'Received.',
      body: { text: "Thanks, {name}. We'll reply {replyTime}.", vars: {} },
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
    copyFailed: "Couldn't copy. Select the address above.",
  },
  next: {
    id: 'next',
    h2: 'What happens after you reach out',
    steps: [
      'You book a time or write to us.',
      { text: 'We reply {replyTime}.', vars: {} },
      { text: 'A {callLength} call.', vars: {} },
      'A short written next step, often a fixed-fee survey proposal.',
    ],
  },
  privacy: {
    id: 'privacy',
    h2: 'What we do with your details',
    body: [
      'We use what you send to reply to you.',
      confirm("We don't sell it or add you to a mailing list.", { id: 'claim.privacy.noSale' }),
      'Messages are delivered by Resend. The calendar is run by Cal.com and loads only when you press Show available times.',
      {
        text: 'We keep messages for {retention}. To have yours deleted, email {email}.',
        vars: { retention, email: site.email },
      },
    ],
    processors: [
      { name: 'Resend', does: 'delivers the messages' },
      { name: 'Cal.com', does: 'runs the calendar' },
      { name: 'Cloudflare Turnstile', does: 'checks for spam, when switched on' },
    ],
    retention,
  },
  closing: {
    id: 'call',
    h2: "Still deciding? The calendar's at the top.",
    body: "Pick a time above, or write to us and we'll find one.",
  },
}

/**
 * Contact strings outside ContactContent (types.ts is frozen): the drawn
 * month grid's day letters, the spam-check status line, and the preview-only
 * booking bench at /kit/contact.
 */
export const contactUi = {
  weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  verifying: "Checking you're not a bot…",
  bench: {
    h1: 'Booking calendar bench',
    deck: 'Preview only. The booking facade with a sample Cal.com link, so the tests can load it without the real one.',
  },
} as const

/** The message the crew receives. Plain text; {name}, {company} and {sheet} are filled per message. */
export const contactMail = {
  subject: 'RFI · {name} · {company} · {sheet}',
  noCompany: 'no company',
  notSure: 'not sure yet',
  divider: '—',
  signals: 'Spam signals',
  none: 'none',
  possibleSpam: '[possible spam]',
} as const
