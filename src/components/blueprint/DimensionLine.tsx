/** A dimension line on a shared scale: the visual length is decorative; the label carries the meaning. */
export function DimensionLine({
  scale,
  span,
  label,
  variant = 'solid',
  ends = 'ticks',
}: {
  scale: readonly [number, number]
  span: readonly [number, number]
  extendTo?: number
  label: string
  variant?: 'solid' | 'range' | 'ticks' | 'dots'
  ends?: 'ticks' | 'arrows'
}) {
  const total = Math.max(1, scale[1] - scale[0])
  const left = ((span[0] - scale[0]) / total) * 100
  const width = Math.max(1, ((span[1] - span[0]) / total) * 100)
  return (
    <div data-dim={variant} data-ends={ends} style={{ position: 'relative' }}>
      <div
        aria-hidden="true"
        style={{
          marginInlineStart: `${left}%`,
          width: `${width}%`,
          borderTop: '2px solid currentColor',
        }}
      />
      <span>{label}</span>
    </div>
  )
}
