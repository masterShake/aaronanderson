import { about } from '@/content/pages/about'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { OrgChartFigure } from '@/figures/org-chart/OrgChartFigure'

export function OrgChart() {
  const c = about.orgChart
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <OrgChartFigure />
    </section>
  )
}
