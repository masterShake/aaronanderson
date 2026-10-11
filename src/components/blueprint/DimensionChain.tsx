import s from './blueprint.module.css'

/**
 * A chain of dimensions, one per step: the step name, its length in words and
 * an optional "You:" line. Horizontal from 1024 px (a running dimension line
 * with a tick at every joint); a vertical chain below that.
 */
export function DimensionChain({
  steps,
}: {
  steps: readonly { label: string; length: string; you?: string }[]
}) {
  return (
    <ol className={s.chain}>
      {steps.map((st) => (
        <li key={st.label}>
          <span className={s.chainLength}>{st.length}</span>
          <span className={s.chainLabel}>{st.label}</span>
          {st.you ? <p className={s.chainYou}>{st.you}</p> : null}
        </li>
      ))}
    </ol>
  )
}
