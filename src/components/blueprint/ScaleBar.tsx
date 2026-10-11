/** A graphic scale bar. Decorative. */
export function ScaleBar() {
  return (
    <svg aria-hidden="true" width="120" height="12" viewBox="0 0 120 12">
      <path d="M0 6H120M0 2V10M60 2V10M120 2V10" stroke="currentColor" fill="none" />
    </svg>
  )
}
