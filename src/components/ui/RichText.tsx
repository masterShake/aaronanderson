import type { ReactNode } from 'react'
import type { Claimable, Confirm, GlossaryId, Held, Rich } from '@/content/types'
import { isConfirm, resolveClaim, resolveHeld } from '@/content/hold'
import { site } from '@/content/site'
import { people } from '@/content/people'
import { glossary } from '@/content/legend'
import { HoldChip } from '@/components/blueprint/HoldChip'
import { ConfirmMark } from '@/components/blueprint/ConfirmMark'
import { Term } from './Term.client'

/**
 * Renders Rich copy: [[id]] or [[id|text]] become glossary toggletips, {name}
 * or {name:word} become vars. Site vars (callLength, replyTime, teamSize) are
 * merged automatically. A HOLD var shows as a chip in preview; in production a
 * var that resolves to nothing removes the whole value (returns null). A
 * pending CONFIRM shows with its mark in preview and is left out in production.
 */

const SITE_VARS: Readonly<Record<string, Held>> = {
  callLength: site.callLength,
  replyTime: site.replyTime,
  teamSize: people.teamSize,
}
const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]
const TOKEN = /\[\[([a-z-]+)(?:\|([^\]]+))?\]\]|\{([a-zA-Z]+)(:word)?\}/g

type Vars = Readonly<Record<string, string | number>>

function render(value: Rich, vars: Vars | undefined): ReactNode[] | null {
  const text = typeof value === 'string' ? value : value.text
  const own = typeof value === 'string' ? {} : value.vars
  const out: ReactNode[] = []
  let last = 0
  let omitted = false
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    last = i + m[0].length
    if (m[1]) {
      const g = glossary.find((t) => t.id === (m[1] as GlossaryId))
      const label = m[2] ?? g?.term ?? m[1]
      const plain = g ? (typeof g.plain === 'string' ? g.plain : g.plain.text) : ''
      out.push(
        g ? (
          <Term key={i} term={g.id} plain={plain}>
            {label}
          </Term>
        ) : (
          label
        ),
      )
      continue
    }
    const name = m[3]!
    const asWord = Boolean(m[4])
    if (vars && name in vars) {
      const v = vars[name]!
      out.push(asWord && typeof v === 'number' && v >= 0 && v <= 12 ? WORDS[v] : String(v))
      continue
    }
    const held = own[name] ?? SITE_VARS[name]
    if (held === undefined) {
      out.push(m[0])
      continue
    }
    const r = resolveHeld(held)
    if (r.show === 'omit') omitted = true
    else if (r.show === 'text') out.push(r.text)
    else out.push(<HoldChip key={i} hold={r.hold} />)
  }
  if (omitted) return null
  if (last < text.length) out.push(text.slice(last))
  return out
}

export interface RichTextProps {
  value: Claimable | Confirm<Rich>
  vars?: Vars
  as?: 'p' | 'span' | 'div' | 'li'
  className?: string
}

export function RichText({ value, vars, as: As = 'p', className }: RichTextProps) {
  if (isConfirm(value)) {
    const r = resolveClaim(value as Confirm<Rich>)
    if (r.show === 'omit') return null
    const parts = render(r.value, vars)
    if (!parts) return null
    // The mark goes inside the block, so a <p> or <li> keeps valid structure.
    return (
      <As className={className}>
        {r.pending && r.id ? <ConfirmMark id={r.id}>{parts}</ConfirmMark> : parts}
      </As>
    )
  }
  const parts = render(value, vars)
  return parts ? <As className={className}>{parts}</As> : null
}
