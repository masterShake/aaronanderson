import type { CSSProperties } from 'react'
import type { heroFigure } from '@/content/figures/hero'
import { HERO_VIEWBOX } from '@/drawings/views/hero'
import type { HeroBuild } from './doc.server'
import s from './hero.module.css'

/**
 * The hero's HTML labels (aria-hidden; the long description carries the meaning). Each label
 * carries its plan centre for both families (--lx/--ly, --lxt/--lyt, percent numbers), its iso
 * print position (--jx/--jy, --jxt/--jyt) and its times (--t pop, --ts scan crossing).
 * data-anchor is the label key the 3D scene projects (--ix/--iy).
 */

type Copy = typeof heroFigure
const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
const [, , WW, WH] = HERO_VIEWBOX.wide
const [, , TW, TH] = HERO_VIEWBOX.tall

const SUB: Readonly<Record<string, 'sym.ai-sub' | 'sym.valve-sub' | 'sym.store-sub'>> = {
  'sym.ai': 'sym.ai-sub',
  'sym.valve': 'sym.valve-sub',
  'sym.store': 'sym.store-sub',
}

const SPEC = {
  estimate: 'spec.estimate',
  inbox: 'spec.inbox',
  field: 'spec.field',
  report: 'spec.report',
} as const

function pos(
  w: readonly [number, number] | undefined,
  t: readonly [number, number] | undefined,
  name: 'l' | 'j',
): Record<string, number> {
  const out: Record<string, number> = {}
  if (w) {
    out[`--${name}x`] = pct(w[0], WW)
    out[`--${name}y`] = pct(w[1], WH)
  }
  if (t) {
    out[`--${name}xt`] = pct(t[0], TW)
    out[`--${name}yt`] = pct(t[1], TH)
  }
  return out
}

export function HeroLabels({ wide, tall, copy }: { wide: HeroBuild; tall: HeroBuild; copy: Copy }) {
  const L = copy.labels as Readonly<Record<string, string>>
  return (
    <>
      {wide.labels.map((l) => {
        const t = tall.labels.find((x) => x.key === l.key)
        const sub = SUB[l.key]
        const style = {
          ...pos(l.at, t?.at, 'l'),
          ...pos(l.iso, t?.iso, 'j'),
          '--t': `${l.pop}ms`,
          '--ts': `${l.scan}ms`,
        } as CSSProperties
        return (
          <span
            key={l.key}
            className={`${s.lab} ${l.key.startsWith('tool.') ? s.tool : s.sym}`}
            data-anchor={l.key}
            {...(t ? {} : { 'data-wide-only': '' })}
            style={style}
          >
            {L[l.key]}
            {sub ? <span className={s.sub}>{L[sub]}</span> : null}
          </span>
        )
      })}
      {wide.places.map((p) => {
        const t = tall.places.find((x) => x.key === p.key)
        const style = {
          ...pos(p.at, t?.at, 'l'),
          '--t': `${p.scan}ms`,
          '--ts': `${p.scan}ms`,
        } as CSSProperties
        return (
          <span key={p.key} className={`${s.lab} ${s.place}`} style={style}>
            {L[p.key]}
          </span>
        )
      })}
      {wide.notes.map((n, j) => {
        const t = tall.notes.find((x) => x.key === n.key)
        const style = {
          ...pos(n.at, t?.at, 'l'),
          '--t': `calc(var(--hero-notes-at) + ${j} * var(--hero-note-gap))`,
          '--ts': `${n.scan}ms`,
          '--tilt': `${j % 2 ? 2 : -3}deg`,
        } as CSSProperties
        return (
          <span
            key={n.key}
            className={`${s.lab} ${s.noteWrap}`}
            {...(t ? {} : { 'data-wide-only': '' })}
            style={style}
          >
            <span className={`note ${s.note}`}>{copy.notes[n.key]}</span>
            <span className={s.spec}>{L[SPEC[n.key]]}</span>
          </span>
        )
      })}
    </>
  )
}
