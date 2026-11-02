import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { planDrawing } from '@/lib/plan/drawing'
import { renderPlanSvg } from '@/lib/plan/svg'

// Generated once at build time from the house spec.
export const dynamic = 'force-static'

export function GET() {
  return new Response(renderPlanSvg(planDrawing(resolveHouse(HOUSE_NO_1))), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  })
}
