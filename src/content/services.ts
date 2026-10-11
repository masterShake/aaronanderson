import { confirm, hold } from './hold'
import type { Service, ServiceId } from './types'

/**
 * The six service sheets, S-01 to S-06, faithful to the brief. Each has a
 * promise, a two-sentence explanation, three or four examples, a "You receive"
 * list and an engagement shape; S-02 to S-04 also have plain terms.
 *
 * Prices: the price chip reads "{label} {value}". A price HOLD's prodFallback
 * stands alone (it is also the schedule's pricing cell), so a renderer shows the
 * fallback without the label when fact(value) is undefined in production.
 */
export const services: readonly Service[] = [
  {
    id: 'S-01',
    slug: 's-01',
    name: 'Systems Survey',
    promise: 'See your whole operation on one drawing, and know exactly what to automate first.',
    explanation: [
      'A short, fixed-scope audit of how work really moves through your firm.',
      'We interview your team, map every tool, spreadsheet and hand-off, and mark where people retype, chase or wait.',
    ],
    examples: [
      'Mapping how an RFI moves from the field to the office and back.',
      'Finding the three spreadsheets that duplicate your accounting system.',
      'Tracing how a new hire gets from offer letter to first paycheck.',
    ],
    receive: [
      { item: 'A schematic of your systems and data flows' },
      {
        item: 'A ranked list of automation opportunities',
        note: 'Rough effort and payoff for each',
      },
      { item: 'A 90-day roadmap' },
    ],
    shape: {
      summary: 'About two weeks, fixed fee. The natural first engagement.',
      span: { weeks: [2, 2] },
      price: {
        label: 'Fixed fee, starting at',
        value: hold('S-01 starting fee, written as it should appear, with currency', {
          id: 'price.s01',
          kind: 'price',
          essential: true,
          prodFallback: 'Fixed fee, quoted on the first call',
        }),
      },
    },
    lengthLabel: 'About two weeks',
    walkAwayWith: 'One drawing of your operation and a ranked to-do list',
    pairedWith: ['S-02'],
    figure: 's01',
    schemaType: 'Business process consulting',
  },
  {
    id: 'S-02',
    slug: 's-02',
    name: 'System Integration',
    promise: 'Enter it once, and it shows up everywhere it should.',
    explanation: [
      'We connect the software you already pay for so data flows between systems automatically.',
      'No double entry, no copy-paste.',
    ],
    plainTerms:
      'An [[integration]] is plumbing between programs. What goes in one end comes out the other, and nobody carries buckets.',
    examples: [
      'Project-management software synced with accounting, such as Procore, QuickBooks or Sage.',
      'CRM leads turned into estimates and projects automatically.',
      'HR and payroll systems sharing onboarding data.',
      'Shared folders kept in sync with the project record.',
    ],
    receive: [
      {
        item: 'Working integrations',
        note: "Through each tool's API or an automation platform",
      },
      { item: 'Documentation' },
      { item: 'Alerts when something breaks' },
    ],
    shape: { summary: 'Two to six weeks for each set of integrations.', span: { weeks: [2, 6] } },
    lengthLabel: 'Two to six weeks per integration set',
    walkAwayWith: 'Your tools passing data with no person in the middle',
    pairedWith: ['S-01', 'S-06'],
    figure: 's02',
    schemaType: 'Software integration',
  },
  {
    id: 'S-03',
    slug: 's-03',
    name: 'AI Workflow Automation',
    promise: 'Hand the repetitive paperwork to AI, and keep people on the decisions.',
    explanation: [
      'AI agents built into your workflows that read, draft, sort and route work.',
      'A person approves anything that matters.',
    ],
    plainTerms: confirm(
      "Think of an [[ai-agent|AI agent]] as a sharp new hire who never gets bored. It reads the document, fills in the fields and puts anything it isn't sure about on a person's desk. It doesn't sign, pay or send anything unless you've decided it may.",
      { id: 'claim.s03.plainTerms' },
    ),
    examples: [
      'Reading invoices, delivery tickets and submittals, and entering the data.',
      'Drafting RFI responses and daily-report summaries from field notes.',
      'Answering questions about specs and contracts from your own documents.',
      'Assembling onboarding packets and checking timesheets against schedules.',
    ],
    receive: [
      { item: 'Working automations', note: 'With review-and-approve steps' },
      { item: 'Usage logs', note: 'A site diary for the machine' },
      { item: 'A simple guide for your team' },
    ],
    shape: {
      summary: 'Three to eight weeks, usually one workflow at a time.',
      span: { weeks: [3, 8] },
    },
    lengthLabel: 'Three to eight weeks, one workflow at a time',
    walkAwayWith: 'Paperwork read, drafted and routed, with sign-off built in',
    pairedWith: ['S-02', 'S-05'],
    figure: 's03',
    schemaType: 'Business process automation',
  },
  {
    id: 'S-04',
    slug: 's-04',
    name: 'Data & Dashboards',
    promise: 'One live picture of the business, without anyone building reports by hand.',
    explanation: [
      'We pull data from your scattered systems into one place and build reports and dashboards that update themselves.',
      'You can also ask your data questions in plain English.',
    ],
    plainTerms:
      'Every system drains into one tank, so every report draws the same water. Ask where a project stands and the answer comes from your own records.',
    examples: [
      'A job-cost [[dashboard]] that updates itself.',
      "A weekly owner's report that writes and sends itself.",
      'Utilization and headcount views for people-operations teams.',
      'A "where are we on this project?" assistant.',
    ],
    receive: [
      { item: 'A unified data layer' },
      { item: 'Dashboards and scheduled reports' },
      { item: 'A short handover session' },
    ],
    shape: { summary: 'Three to six weeks.', span: { weeks: [3, 6] } },
    lengthLabel: 'Three to six weeks',
    walkAwayWith: 'Reports that build and send themselves',
    pairedWith: ['S-02', 'S-06'],
    figure: 's04',
    schemaType: 'Business intelligence and reporting',
  },
  {
    id: 'S-05',
    slug: 's-05',
    name: 'Team Enablement',
    promise: 'Tools your crew actually uses.',
    explanation: [
      'Practical training and playbooks so your people get real value from new systems and from AI, safely.',
      'Taught on your tools, with your work, not slides about the future.',
    ],
    examples: [
      'Hands-on sessions for office and field staff.',
      '[[prompt|Prompt]] playbooks for estimators and project managers.',
      'A simple, sensible AI-use policy.',
      'Recorded walkthroughs for new hires.',
    ],
    receive: [
      { item: 'Training sessions' },
      { item: 'Written playbooks' },
      { item: 'An AI-use guideline' },
    ],
    shape: {
      summary: 'A few sessions, often bundled with S-02 to S-04.',
      span: { sessions: true },
    },
    lengthLabel: 'A few sessions',
    walkAwayWith: 'A crew that knows how to use it, safely',
    pairedWith: ['S-02', 'S-03', 'S-04'],
    figure: 's05',
    schemaType: 'Technology training',
  },
  {
    id: 'S-06',
    slug: 's-06',
    name: 'Run & Improve',
    promise: 'We keep the machine running, and make it better every month.',
    explanation: [
      'A monthly retainer: we monitor your integrations and automations.',
      'We fix what breaks and ship small improvements.',
    ],
    examples: [
      'Watching for failed syncs and fixing them before anyone notices.',
      'Adjusting automations when a process changes.',
      'Adding one new automation each month.',
    ],
    receive: [
      { item: 'Monitoring' },
      { item: 'A monthly health report' },
      { item: 'Improvement hours', note: '{hours} hours each month' },
    ],
    shape: {
      summary: 'Monthly. Cancel anytime.',
      span: { monthly: true },
      price: {
        label: 'Monthly from',
        value: hold('S-06 monthly price, written as it should appear, with currency', {
          id: 'price.s06',
          kind: 'price',
          essential: true,
          prodFallback: 'Monthly, quoted on the first call',
        }),
      },
      improvementHours: hold(
        'Improvement hours per month, as a capitalized word (it starts the line)',
        {
          id: 'hours.s06',
          kind: 'count',
          prodFallback: 'A set number of',
        },
      ),
    },
    lengthLabel: 'Monthly, cancel anytime',
    walkAwayWith: 'Somebody minding the machine',
    pairedWith: ['S-02', 'S-03', 'S-04'],
    figure: 's06',
    schemaType: 'Managed automation support',
  },
]

export const serviceById = (id: ServiceId): Service => {
  const s = services.find((x) => x.id === id)
  if (!s) throw new Error('Unknown service ' + id)
  return s
}
