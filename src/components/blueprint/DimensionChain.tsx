import s from './blueprint.module.css'

/** A chain of dimensions, one per step, each with an optional "You:" line. */
export function DimensionChain({
  steps,
}: {
  steps: readonly { label: string; length: string; you?: string }[]
}) {
  return (
    <ol className={s.notes}>
      {steps.map((st) => (
        <li key={st.label}>
          <strong>{st.label}</strong> · {st.length}
          {st.you ? <p>{st.you}</p> : null}
        </li>
      ))}
    </ol>
  )
}
