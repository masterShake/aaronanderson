import type { Service } from '@/content/types'
import { SHOW_HOLDS, fact } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'

/**
 * A price: "{label} {value}" once the value is real (or as a HOLD in preview).
 * In production, while the price is still a HOLD, its prodFallback is written
 * to stand alone ("Fixed fee, quoted on the first call"), so the label is left out.
 */
export function PriceText({ price }: { price: NonNullable<Service['shape']['price']> }) {
  if (fact(price.value) !== undefined || SHOW_HOLDS)
    return (
      <>
        {price.label} <HeldText value={price.value} />
      </>
    )
  return <HeldText value={price.value} />
}
