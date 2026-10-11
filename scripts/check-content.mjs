/**
 * The content rules (PLAN D11), checked statically over src/content:
 * no banned words, no placeholders, digits only in fact fields, hold() notes,
 * vars and a short list of patterns (durations are written in words), no
 * repeated sentence of five words or more, hand notes at most 6 per figure
 * and 12 site-wide (each unique), and US spelling.
 *
 *   npm run check:content [-- --no-stubs]
 */
import { readFileSync } from 'node:fs'
import { listTs, strings } from './lib/content-ast.mjs'

const NO_STUBS = process.argv.includes('--no-stubs')
const FILES = listTs('src/content', [
  'src/content/types.ts',
  'src/content/hold.ts',
  'src/content/index.ts',
])
const SKIP_KEYS = new Set([
  'id',
  'key',
  'href',
  'slug',
  'sheet',
  'page',
  'figure',
  'scene',
  'symbol',
  'see',
  'kind',
  'status',
  'url',
  'schemaType',
  'locale',
  'stamp',
  'tag',
])
const FACT_KEYS = new Set([
  'price',
  'callLength',
  'replyTime',
  'improvementHours',
  'phone',
  'email',
  'howLong',
  'teamSize',
  'retention',
  'legalName',
  'location',
  'date',
  'copyright',
])
const BANNED = [
  'revolutionize',
  'revolutionise',
  'revolutionary',
  'synergy',
  'synergies',
  'synergistic',
  'cutting-edge',
  'cutting edge',
  'bleeding-edge',
  'game-changer',
  'game-changing',
  'paradigm',
  'next-gen',
  'next-generation',
  'world-class',
  'best-in-class',
  'state-of-the-art',
  'disrupt',
  'disruptive',
  'supercharge',
  'turbocharge',
  'seamless',
  'seamlessly',
  'leverage',
  'unlock',
  'empower',
  'empowering',
  'holistic',
  'robust',
  'ai-powered',
  'innovative',
  'effortless',
  'magic',
  'journey',
  'ecosystem',
]
const BANNED_RE = new RegExp(
  `(^|[^a-z])(${BANNED.map((w) => w.replace(/[-\s]/g, '[-\\s]')).join('|')})(?=$|[^a-z])`,
  'i',
)
const PLACEHOLDER_RE = /\b(lorem|ipsum|todo|tbd|fixme|xxx)\b|\$X|\[HOLD\]|\[placeholder\]|⟦/i
/** British spellings the site must not use (US English, matching the brief). */
const UK = [
  'colour',
  'behaviour',
  'favour',
  'honour',
  'labour',
  'neighbour',
  'organis',
  'realis',
  'recognis',
  'prioritis',
  'optimis',
  'analys(?:e|ed|es|ing)\\b',
  'centre',
  'metre',
  'litre',
  'aluminium',
  'licence',
  'defence',
  'programme',
  'catalogue',
  'cheque',
  'modelling',
  'travelled',
  'cancelled',
  'judgement',
  'utilis',
  'whilst',
  'amongst',
]
const UK_RE = new RegExp(`\\b(${UK.join('|')})`, 'i')
const ALLOW_DIGITS = [
  /\b[GSP]-0\d\b/g, // sheet numbers
  /\bREV \d\b/g, // revision chips
  /Δ\d/g, // delta tags
  /\bDETAIL \d+\b/g, // detail numbers
  /\b1:1\b/g, // scale note
  /\b90-day\b/gi, // brief: 90-day roadmap
  /Estimate_FINAL_v7\.xlsx/g, // example file name (EXAMPLE FIRM)
  /\{[a-zA-Z]+(?::word)?\}/g, // vars
]
const NOTES_PER_FIGURE = 6
const NOTES_SITE_WIDE = 12

const errors = []
const add = (s, rule, msg) => errors.push(`${s.file}:${s.line}:${s.col}  ${rule}  ${msg}`)
const sentences = new Map()

for (const f of FILES) {
  if (NO_STUBS && readFileSync(f, 'utf8').includes('@stub'))
    errors.push(`${f}  stub  still marked @stub`)
  for (const s of strings(f)) {
    if (s.template) {
      add(s, 'no-template', 'Use Rich vars, not ${} templates, in content.')
      continue
    }
    const isNote = s.call && s.call.name === 'hold' && s.call.arg === 0
    if (s.key && SKIP_KEYS.has(s.key)) continue
    if (BANNED_RE.test(s.value)) add(s, 'banned-word', JSON.stringify(s.value.match(BANNED_RE)[2]))
    if (PLACEHOLDER_RE.test(s.value))
      add(s, 'placeholder', 'Use hold() for anything still to come.')
    if (!isNote && UK_RE.test(s.value))
      add(s, 'us-spelling', `${JSON.stringify(s.value.match(UK_RE)[1])}: use US English`)
    if (!isNote && !s.path.some((k) => FACT_KEYS.has(k))) {
      const stripped = ALLOW_DIGITS.reduce((v, re) => v.replace(re, ''), s.value)
      if (/\d/.test(stripped))
        add(s, 'digit', `${JSON.stringify(s.value)}: digits only in fact fields, holds or vars`)
    }
    // Hold notes may repeat; SEO titles and descriptions restate their page on purpose.
    if (isNote || s.file === 'src/content/seo.ts') continue
    for (const raw of s.value.split(/(?<=[.!?])\s+/)) {
      const norm = raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (norm.split(' ').length < 5) continue
      const prev = sentences.get(norm)
      if (prev && prev !== `${s.file}:${s.line}`) add(s, 'duplicate', `also at ${prev}: "${raw}"`)
      else sentences.set(norm, `${s.file}:${s.line}`)
    }
  }
}

// Hand notes: at most 6 per figure and 12 site-wide, each one unique.
const allNotes = new Map()
for (const f of listTs('src/content/figures')) {
  const notes = strings(f).filter((s) => s.path.at(-2) === 'notes')
  if (notes.length > NOTES_PER_FIGURE)
    errors.push(`${f}  notes  ${notes.length} hand notes (max ${NOTES_PER_FIGURE})`)
  for (const n of notes) {
    const k = n.value.toLowerCase().trim()
    if (allNotes.has(k)) add(n, 'notes', `hand note repeated (also at ${allNotes.get(k)})`)
    else allNotes.set(k, `${n.file}:${n.line}`)
  }
}
if (allNotes.size > NOTES_SITE_WIDE)
  errors.push(
    `src/content/figures  notes  ${allNotes.size} hand notes site-wide (max ${NOTES_SITE_WIDE})`,
  )

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\ncheck-content: ${errors.length} problem(s)`)
  process.exit(1)
}
console.log(`check-content: ${FILES.length} files clean (${allNotes.size} hand notes)`)
