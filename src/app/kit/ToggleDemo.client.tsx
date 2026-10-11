'use client'
import { useState } from 'react'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle.client'

/** /kit only: a live SegmentedToggle (copy comes in as props). */
export function ToggleDemo({
  label,
  options,
}: {
  label: string
  options: readonly [{ value: string; label: string }, { value: string; label: string }]
}) {
  const [value, setValue] = useState(options[0].value)
  return <SegmentedToggle label={label} options={options} value={value} onChange={setValue} />
}
