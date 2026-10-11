/** A redline revision cloud around a box (owner: drawings lane). W0: a dashed rounded frame. */
export function RevisionCloud({
  width,
  height,
  tag,
  tone = 'redline',
}: {
  width: number
  height: number
  tag?: string
  seed?: number
  tone?: 'redline' | 'hold'
}) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-tag={tag}
    >
      <rect
        x="2"
        y="2"
        width={width - 4}
        height={height - 4}
        rx="24"
        fill="none"
        stroke={tone === 'redline' ? 'var(--c-redline)' : 'var(--c-graphite)'}
        strokeWidth="2"
        strokeDasharray="6 4"
      />
    </svg>
  )
}
