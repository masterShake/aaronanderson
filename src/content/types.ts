import type { Route } from 'next'
import type { Claim, Confirm, Held, Hold } from './hold'
export type { Claim, Confirm, Held, Hold }

/**
 * The shape of every piece of copy on the site. Frozen after W0: a lane that
 * needs a change files a request with the integrator.
 */

// ids
export type PageKey = 'home' | 'services' | 'how-it-works' | 'about' | 'contact'
export type SheetId = 'G-01' | 'S-00' | 'P-00' | 'G-02' | 'G-03'
export type ServiceId = 'S-01' | 'S-02' | 'S-03' | 'S-04' | 'S-05' | 'S-06'
export type ServiceSlug = 's-01' | 's-02' | 's-03' | 's-04' | 's-05' | 's-06'
export type ProcessId = 'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05'
export type GlossaryId =
  | 'api'
  | 'integration'
  | 'automation-platform'
  | 'data-layer'
  | 'dashboard'
  | 'language-model'
  | 'ai-agent'
  | 'prompt'
  | 'retrieval'
  | 'hallucination'
  | 'human-in-the-loop'
  | 'usage-log'
  | 'webhook'
export type LegendSymbolId =
  | 'tool'
  | 'conduit'
  | 'hand-carry'
  | 'packet'
  | 'ai-step'
  | 'sign-off'
  | 'tolerance'
  | 'data-store'
  | 'monitor'
  | 'logbook'
  | 'revision-cloud'
  | 'hold'
/** Every figure on the site. The DOM id is `fig-{FigureId}` (src/figures/types.ts). */
export type FigureId =
  | 'hero'
  | 'firm'
  | 's01'
  | 's02'
  | 's03'
  | 's04'
  | 's05'
  | 's06'
  | 'ticket'
  | 'valve'
  | 'org-chart'
  | 'strata'
  | 'after-contact'
  | 'not-found'
export type StatusStamp =
  | 'EXISTING CONDITIONS'
  | 'ISSUED FOR REVIEW'
  | 'ISSUED FOR CONSTRUCTION'
  | 'AS-BUILT'
  | 'IN SERVICE'
export type PlateId = 'guard' | 'interlock' | 'logbook' | 'off-switch' | 'inspection'
export type CrewTag = 'FIELD' | 'OFFICE' | 'CODE'
export type Href = Route | `mailto:${string}` | `tel:${string}` | `https://${string}`

/**
 * Rich text. Tokens in the text:
 *   [[api]] or [[api|the API]]  -> glossary toggletip (real GlossaryIds only)
 *   {name} or {name:word}       -> a var. Content-supplied vars are Held; render-time vars are
 *                                  numbers or strings (graph counts, for example). :word spells
 *                                  0 to 12 as words. RichText merges the site vars callLength and
 *                                  replyTime automatically.
 * In production, a Held var that resolves to 'omit' removes the whole Rich value.
 */
export type Rich = string | { readonly text: string; readonly vars: Readonly<Record<string, Held>> }
/** Copy that may be a promise the owner has to CONFIRM. RichText resolves claims. */
export type Claimable = Rich | Claim
export interface Link {
  readonly label: string
  readonly href: Href
}
export interface SectionHead {
  readonly id: string
  readonly h2: string
  readonly body?: readonly Claimable[]
}
export interface CtaBand {
  /** 'call' on every page. */
  readonly id: string
  readonly h2: string
  readonly body: Rich
  readonly cta?: string
  readonly secondary?: Rich
}

// site and chrome
export interface NavItem {
  readonly page: PageKey
  readonly href: Route
  readonly label: string
  readonly sheet: SheetId
  readonly sheetTitle: string
}
export interface RevRow {
  readonly rev: string
  readonly date: string
  readonly note: string
}
export interface TitleBlockCopy {
  readonly sheetIndex: string
  readonly drawnBy: { readonly label: string; readonly value: Held }
  readonly checkedBy: { readonly label: string; readonly value: Held }
  readonly approvedBy: { readonly label: string; readonly value: string }
  readonly revisions: {
    readonly label: string
    readonly columns: readonly [string, string, string]
    readonly rows: readonly RevRow[]
  }
  readonly labels: {
    readonly email: string
    readonly phone: string
    readonly location: string
    readonly motion: string
  }
  readonly notes: { readonly title: string; readonly items: readonly (string | Claim)[] }
  readonly northArrow: string
  /** '© {year} Actual Engineer'; {year} is filled at render. */
  readonly copyright: string
}
export interface SiteConfig {
  readonly name: string
  readonly wordmark: string
  readonly url: `https://${string}`
  readonly locale: 'en-US'
  readonly legalName: Held
  /** Essential. */
  readonly email: Held
  /** Shown only once filled (no prodFallback). */
  readonly phone: Held
  /** Footer LOCATION cell; also areaServed. */
  readonly location: Held
  readonly areaServed: readonly Held[]
  readonly sameAs: readonly Held[]
  /** Essential fact, e.g. '30-minute'. */
  readonly callLength: Held
  /** Fact, e.g. 'within one working day'. */
  readonly replyTime: Held
  /** 'EXAMPLE FIRM — NOT A CLIENT'. Defined once, referenced everywhere. */
  readonly exampleTag: string
  /** 'SAMPLE'. */
  readonly sampleTag: string
  /** url is an essential HOLD (id site.scheduler.url). next.config.ts builds the CSP from it. */
  readonly scheduler: { readonly url: Held; readonly autoload: false }
  readonly cta: { readonly book: string; readonly href: Route }
  readonly nav: readonly NavItem[]
  readonly header: {
    readonly navLabel: string
    readonly menu: string
    readonly menuTitle: string
    readonly close: string
    readonly home: string
  }
  readonly skipLink: string
  readonly motion: {
    readonly label: string
    /** The first word(s) of `label`, shown alone in the header where the bar is tight. */
    readonly short: string
    readonly on: string
    readonly off: string
  }
  /** The mono strip over every H1, e.g. 'SHEET' and 'SCALE: AS NOTED'. */
  readonly sheet: { readonly label: string; readonly scale: string }
  /** Preview-only marks. */
  readonly marks: {
    readonly hold: string
    readonly confirm: string
    readonly holdLabel: string
    readonly confirmLabel: string
  }
  readonly titleBlock: TitleBlockCopy
}

// pages
export interface HomeContent {
  readonly hero: {
    /** short (below 640 px) drops 'COVER SHEET'. */
    readonly eyebrow: { readonly full: string; readonly short: string }
    readonly h1: string
    readonly signoff: string
    readonly deck: Rich
    /** Goes to /#fig-hero; hidden at 1024 px and up. */
    readonly seeDrawing: { readonly label: string; readonly href: Route }
    readonly specLine: string
  }
  readonly wiring: SectionHead & {
    readonly bodyTouch: Rich
    readonly kicker: string
    readonly newNote: string
  }
  readonly sheetIndex: SectionHead & {
    readonly caption: string
    readonly columns: {
      readonly sheet: string
      readonly service: string
      readonly walkAway: string
      readonly length: string
    }
    readonly startHere: string
  }
  readonly process: SectionHead & { readonly youPrefix: string; readonly link: Link }
  readonly crew: SectionHead & {
    readonly approvedBy: { readonly label: string; readonly value: string }
    readonly link: Link
    /** While no crew name or role is confirmed: no cards, and this link instead of `link`. */
    readonly linkNoCrew: Link
  }
  /** Preview only; production leaves the section out until proof is real. */
  readonly asBuilts: SectionHead
  readonly closing: CtaBand
}
export interface ServicesPageContent {
  readonly h1: string
  readonly deck: Rich
  readonly schedule: SectionHead & {
    readonly caption: string
    readonly columns: {
      readonly sheet: string
      readonly service: string
      readonly length: string
      readonly pricing: string
      readonly pairedWith: string
    }
    readonly chart: {
      readonly caption: string
      readonly unit: string
      readonly sessions: string
      readonly monthly: string
    }
    /** Pricing cell for S-02 to S-05. */
    readonly quoted: string
  }
  readonly rail: { readonly label: string; readonly jump: string }
  readonly sheet: {
    readonly examples: string
    readonly receive: string
    readonly receiveColumns: readonly [string, string]
    readonly shape: string
    readonly plainTerms: string
    /** {sheet} */
    readonly talk: Rich
    readonly keyPlan: string
  }
  readonly nic: SectionHead & { readonly items: readonly Claim[] }
  readonly closing: CtaBand
}
export type Span =
  | { readonly weeks: readonly [number, number] }
  | { readonly sessions: true }
  | { readonly monthly: true }
  | { readonly held: true }
export interface Service {
  readonly id: ServiceId
  readonly slug: ServiceSlug
  readonly name: string
  readonly promise: string
  readonly explanation: readonly [string, string]
  /** S-02 to S-04. */
  readonly plainTerms?: Claimable
  /** Three or four. */
  readonly examples: readonly Rich[]
  readonly receive: readonly { readonly item: string; readonly note?: string }[]
  readonly shape: {
    readonly summary: Rich
    readonly span: Exclude<Span, { held: true }>
    /** S-01 and S-06 only. */
    readonly price?: { readonly label: string; readonly value: Held }
    readonly improvementHours?: Held
  }
  readonly lengthLabel: string
  readonly walkAwayWith: string
  readonly pairedWith: readonly ServiceId[]
  readonly figure: Extract<FigureId, 's01' | 's02' | 's03' | 's04' | 's05' | 's06'>
  readonly schemaType: string
}
export interface ProcessStep {
  readonly id: ProcessId
  readonly name: string
  readonly title: string
  readonly stamp: StatusStamp
  readonly weDo: Rich
  readonly youDo: Rich
  readonly howLong: Held
  readonly span: Span
  readonly youGet: Rich
  /** Six to eight words, for the Home strip. */
  readonly youShort: string
  readonly rev: { readonly change: string; readonly approvedBy: string }
  readonly stillCaption: string
}
export interface HowItWorksContent {
  readonly h1: string
  readonly deck: Rich
  readonly ticket: SectionHead
  readonly spec: {
    readonly weDo: string
    readonly youDo: string
    readonly howLong: string
    readonly youGet: string
  }
  readonly revTable: {
    readonly caption: string
    readonly columns: readonly [string, string, string, string]
  }
  readonly control: SectionHead & {
    readonly plates: readonly {
      readonly id: PlateId
      readonly title: string
      readonly text: Claim
    }[]
  }
  readonly legend: SectionHead & {
    readonly symbolsCaption: string
    readonly glossaryCaption: string
    readonly columns: readonly [string, string, string]
  }
  readonly faq: SectionHead & {
    readonly logLabel: string
    readonly open: string
    readonly closed: string
  }
  readonly closing: CtaBand
}
export interface LegendSymbol {
  readonly id: LegendSymbolId
  readonly term: string
  readonly plain: string
}
export interface GlossaryTerm {
  readonly id: GlossaryId
  readonly term: string
  readonly plain: Rich
  readonly see?: LegendSymbolId
}
export interface FaqItem {
  readonly id: string
  readonly q: string
  readonly a: Rich | Hold | Confirm<Rich>
}
export interface Person {
  readonly id: string
  /** Essential. */
  readonly name: Held
  readonly role: Held
  readonly oneLine: Held
  readonly bio: Held
  readonly tags: readonly CrewTag[]
  readonly askMeAbout: Held
  /** '/crew/<id>.jpg' once real. */
  readonly photo: Held
  readonly linkedin: Held
}
export interface PeopleContent {
  readonly teamSize: Held
  readonly people: readonly Person[]
}
export interface AboutContent {
  readonly h1: string
  readonly deck: Rich
  readonly crew: SectionHead & {
    readonly tags: Readonly<Record<CrewTag, string>>
    readonly askLabel: string
    readonly photoAlt: Rich
    readonly linkedin: string
  }
  readonly strata: SectionHead & {
    readonly layers: readonly {
      readonly id: 'field' | 'office' | 'code'
      readonly label: string
      readonly text: Held
    }[]
  }
  readonly notes: SectionHead & { readonly items: readonly Claim[] }
  readonly beliefs: SectionHead
  readonly orgChart: SectionHead & {
    readonly toggle: { readonly label: string; readonly usual: string; readonly ours: string }
  }
  readonly closing: CtaBand
}
export interface FieldCopy {
  readonly label: string
  readonly hint?: Rich
}
export interface ContactFormCopy {
  readonly id: 'write'
  readonly h2: string
  /** The H2 when production hides the booking block; the section then takes id="book". */
  readonly headingNoScheduler: string
  readonly intro: Rich
  readonly fields: {
    readonly name: FieldCopy
    readonly email: FieldCopy
    readonly company: FieldCopy & { readonly optional: string }
    readonly sheet: FieldCopy & { readonly notSure: string }
    readonly message: FieldCopy & { readonly min: number; readonly max: number }
  }
  readonly honeypot: string
  readonly submit: string
  readonly pending: string
  readonly errorSummary: string
  readonly errors: {
    readonly required: string
    readonly email: string
    readonly tooShort: Rich
    readonly tooLong: Rich
    readonly verify: string
    readonly rateLimited: string
    readonly server: string
    readonly expired: string
    readonly notConfigured: string
  }
  readonly success: { readonly title: string; readonly body: Rich; readonly live: string }
  readonly noScript: Rich
}
export interface ContactContent {
  readonly h1: string
  /** The H1 while there is no booking calendar (the link is a HOLD and review mode is off). */
  readonly h1NoScheduler: string
  readonly deck: Rich
  readonly book: SectionHead & {
    readonly facade: {
      readonly show: string
      readonly note: Rich
      readonly newTab: string
      readonly loading: string
      readonly loaded: string
      readonly slow: Rich
      readonly failed: Rich
      readonly booked: Rich
      readonly region: string
    }
    readonly holdNote: string
  }
  readonly form: ContactFormCopy
  readonly email: SectionHead & {
    readonly copy: string
    readonly copied: string
    readonly copiedLive: string
    readonly copyFailed: string
  }
  readonly next: SectionHead & {
    readonly steps: readonly [Rich, Rich, Rich, Rich]
    /** Replaces steps[0] while there is no booking calendar. */
    readonly firstStepNoScheduler: Rich
  }
  /** The privacy lines live in body (Claimable). */
  readonly privacy: SectionHead & {
    /** `scheduler: true` rows are listed only while the booking calendar is on the page. */
    readonly processors: readonly {
      readonly name: string
      readonly does: string
      readonly scheduler?: boolean
    }[]
    readonly retention: Held
  }
  /** `bodyNoScheduler` replaces `body` while there is no booking calendar. */
  readonly closing: CtaBand & { readonly bodyNoScheduler: Rich }
  /** Booking notes Cal.com receives when the visitor came from a service sheet (?sheet=S-03). */
  readonly bookingNotes: string
}
export interface NotFoundContent {
  readonly h1: string
  readonly body: string
  readonly links: string
}
/** app/error.tsx and app/global-error.tsx. */
export interface ErrorContent {
  readonly h1: string
  readonly body: string
  readonly retry: string
  readonly links: string
}
export interface ProofContent {
  readonly caseStudies: readonly Hold[]
  readonly testimonials: readonly Hold[]
  readonly logos: Hold
  readonly stats: readonly Hold[]
}
/** Preview-only pages: /punch-list and /kit. Production returns 404 for both. */
export interface PreviewContent {
  readonly punchList: {
    readonly h1: string
    readonly deck: Rich
    readonly essential: string
    readonly optional: string
    readonly pending: string
    readonly columns: readonly [string, string, string]
    readonly empty: string
  }
  readonly kit: {
    readonly h1: string
    readonly deck: Rich
    readonly stage: { readonly h1: string; readonly deck: Rich; readonly probe: string }
  }
}

// SEO
export type SeoKey = PageKey | 'not-found' | 'punch-list' | 'kit'
export interface PageSeo {
  readonly title: string
  readonly absolute?: boolean
  readonly description: string
  readonly og: { readonly kicker: string; readonly title: string; readonly alt: string }
}
export type SeoContent = Readonly<Record<SeoKey, PageSeo>>

// figures
export type FigureControl =
  | 'pause'
  | 'replay'
  | 'playDrawing'
  | 'runAgain'
  | 'runAnother'
  | 'approve'
  | 'ask'
  | 'showTable'
  | 'legend'
export interface FigureCopy<
  L extends string = string,
  N extends string = string,
  A extends string = string,
  V extends string = string,
  U extends string = string,
> {
  readonly id: FigureId
  /** 'DETAIL 1 / G-01' */
  readonly detail: string
  readonly title: string
  /** Reference site.exampleTag or site.sampleTag. */
  readonly tag?: string
  readonly caption: Rich
  /** Read by screen readers in place of the drawing; counts come from vars. */
  readonly longDescription: readonly Rich[]
  /** Keys match the drawing's label keys. */
  readonly labels: Readonly<Record<L, string>>
  /** At most 6 hand notes per figure and 12 site-wide, sentence case (CSS sets capitals). */
  readonly notes?: Readonly<Record<N, string>>
  /** aria-live readouts; counts come from vars. */
  readonly live?: Readonly<Record<A, Rich>>
  /** Rev chip text by state id. */
  readonly revs?: Readonly<Record<V, string>>
  readonly controls?: Readonly<Partial<Record<FigureControl, string>>>
  readonly table?: { readonly caption: string; readonly columns: readonly string[] }
  /** Any other figure UI strings: keyboard help, callout templates, chips, answers. */
  readonly ui?: Readonly<Record<U, Rich>>
}
