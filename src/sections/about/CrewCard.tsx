import type { Person } from '@/content/types'
import { about } from '@/content/pages/about'
import { fact, resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { HoldCloud } from '@/components/blueprint/HoldCloud'
import s from './crew.module.css'

/**
 * One crew member as title-block cells (About), or the compact card Home E
 * uses. Every fact is a HOLD until the owner fills it in: the photo is a
 * hatched HOLD cloud; in production a missing name falls back to the role as
 * the heading, and rows with nothing to show are left out.
 */
export function CrewCard({
  person: p,
  compact = false,
  level = 3,
}: {
  person: Person
  compact?: boolean
  level?: 3 | 4
}) {
  const c = about.crew
  const H = level === 3 ? 'h3' : 'h4'
  const name = resolveHeld(p.name)
  // In production, a name and a role both still held leave nothing to head the card with.
  const showHead = name.show !== 'omit' || resolveHeld(p.role).show !== 'omit'
  const photo = resolveHeld(p.photo)
  const bio = compact ? p.oneLine : p.bio
  const showBio = resolveHeld(bio).show !== 'omit'
  const showAsk = !compact && resolveHeld(p.askMeAbout).show !== 'omit'
  const linkedin = compact ? undefined : fact(p.linkedin)
  const realName = fact(p.name)
  const altTemplate = typeof c.photoAlt === 'string' ? c.photoAlt : c.photoAlt.text
  const altText = realName ? altTemplate.replace('{name}', realName) : ''
  return (
    <li className={`${s.card} ${compact ? s.compact : ''}`} data-person={p.id}>
      <div className={s.photo}>
        {photo.show === 'text' ? (
          // a real crew photo, once supplied; static files need no next/image here
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.text} alt={altText} loading="lazy" />
        ) : photo.show === 'hold' ? (
          <HoldCloud hold={photo.hold} kind="photo" minHeight={0} />
        ) : null}
      </div>
      <div className={s.cells}>
        {showHead ? (
          <div className={s.cell}>
            <H className={s.name}>
              {name.show === 'omit' ? <HeldText value={p.role} /> : <HeldText value={p.name} />}
            </H>
            {name.show !== 'omit' ? (
              <p className={s.role}>
                <HeldText value={p.role} />
              </p>
            ) : null}
          </div>
        ) : null}
        {showBio ? (
          <div className={s.cell}>
            <p className={s.bio}>
              <HeldText value={bio} />
            </p>
          </div>
        ) : null}
        <div className={`${s.cell} ${s.tagCell}`}>
          <ul className={s.tags}>
            {(Object.keys(c.tags) as (keyof typeof c.tags)[]).map((t) =>
              p.tags.includes(t) ? (
                <li key={t} className={s.on}>
                  {c.tags[t]}
                </li>
              ) : (
                <li key={t} aria-hidden="true">
                  {c.tags[t]}
                </li>
              ),
            )}
          </ul>
        </div>
        {showAsk ? (
          <div className={s.cell}>
            <p className={s.ask}>
              <span className={s.cellLabel}>{c.askLabel}</span> <HeldText value={p.askMeAbout} />
            </p>
          </div>
        ) : null}
        {linkedin ? (
          <div className={s.cell}>
            <a href={linkedin} className={s.link}>
              {c.linkedin}
            </a>
          </div>
        ) : null}
      </div>
    </li>
  )
}
