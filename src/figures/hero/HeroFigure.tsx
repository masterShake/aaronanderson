import type { CSSProperties } from 'react'
import { heroFigure as copy } from '@/content/figures/hero'
import { HERO_VIEWBOX, heroGraph } from '@/drawings/views/hero'
import { counts } from '@/drawings/lib/counts'
import { FigureFrame } from '@/figures/FigureFrame'
import { FigureBoundary } from '@/figures/FigureBoundary.client'
import { HERO } from '@/motion/timing/hero'
import { cssVars } from '@/motion/timing-css'
import { heroBuild } from './doc.server'
import { HeroLayers } from './HeroLayers'
import { HeroLabels } from './HeroLabels'
import { HeroController } from './HeroController.client'
import { HeroGate } from './HeroGate.client'
import { GATE } from '@/motion/timing/global'
import { BREAKPOINT } from '@/styles/tokens'
import s from './hero.module.css'

/**
 * DETAIL 1 / G-01, the signature figure (D2 A). Inline (the only inline drawing): the pencil
 * sketch, the redline clouds, the scan to the rewired CAD plan, then the plan mechanism and
 * the iso print as its idle frame, all CSS animations offset from one start
 * (src/motion/timing/hero.ts). HeroController registers the Stage; with WebGL ready it hands
 * off at the plan frame (HERO.decisionAt) or, on desktop, at the loop boundary.
 */

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100

export function HeroFigure() {
  const wide = heroBuild('wide')
  const tall = heroBuild('tall')
  const c = counts(heroGraph('wide'), 'asFound')
  const [, , ww, wh] = HERO_VIEWBOX.wide
  const [vx, vy] = wide.approved
  const [vxt, vyt] = tall.approved
  const r = wide.report
  const rt = tall.report
  const vars = {
    ...cssVars(HERO, 'hero'),
    '--t-scan': `${HERO.scanStart}ms`,
    '--hero-approve-first': `${HERO.decisionAt + wide.approve.first}ms`,
    '--hero-approve-every': `${wide.approve.every}ms`,
  } as const
  const box = (x: number, y: number, xt: number, yt: number) =>
    ({
      '--lx': pct(x, ww),
      '--ly': pct(y, wh),
      '--lxt': pct(xt, HERO_VIEWBOX.tall[2]),
      '--lyt': pct(yt, HERO_VIEWBOX.tall[3]),
    }) as CSSProperties
  const chips = (['asFound', 'rewired', 'running', 'done'] as const).map((rev, i) => (
    <span key={rev} className={`${s.chip} ${s[`chip${i}`]}`} data-chip={rev}>
      {copy.revs[rev]}
    </span>
  ))
  return (
    <FigureFrame
      id="hero"
      copy={copy}
      className={s.hero}
      layouts={{ wide: HERO_VIEWBOX.wide, tall: HERO_VIEWBOX.tall }}
      driver="time"
      stage={{ scene: 'hero', load: 'hero', mode: 'timeline' }}
      vars={vars}
      textVars={{ tools: c.tools, lines: c.handoffs, people: c.peopleOnLines }}
      controls={{
        motion: true,
        playDrawing: true,
        extra: (
          <>
            <span className={s.chips} aria-hidden="true">
              {chips}
            </span>
            <button
              type="button"
              data-action="again"
              className={s.again}
              aria-describedby="fig-hero-again-hint"
            >
              {copy.controls.runAgain}
            </button>
            <span id="fig-hero-again-hint" className="sr-only">
              {copy.ui.runAgainHint}
            </span>
          </>
        ),
      }}
      drawing={<HeroLayers wide={wide.doc} tall={tall.doc} />}
      labels={
        <>
          <HeroLabels wide={wide} tall={tall} copy={copy} />
          {/* beside the person at the valve, under the sign-off label */}
          <span className={s.approved} style={box(vx, vy, vxt, vyt)}>
            {copy.ui.approved}
          </span>
          <span
            className={s.report}
            style={box(r.at[0] - r.w / 4, r.at[1] + 6, rt.at[0] - rt.w / 4, rt.at[1] + 4)}
          />
          <span className={s.idle}>{copy.ui.idle}</span>
          <span className={s.clock} data-clock="" />
        </>
      }
      still={
        <div className={s.inset}>
          <HeroLayers wide={wide.inset} tall={tall.inset} prefix="ins" />
          <span className={s.insetTag}>{copy.ui.inset}</span>
          <span className={s.leader}>{copy.ui.leader}</span>
        </div>
      }
    >
      <HeroGate ratio={GATE.entry} wide={BREAKPOINT.lg} />
      <FigureBoundary figureId="hero">
        <HeroController liveDone={typeof copy.live.done === 'string' ? copy.live.done : ''} />
      </FigureBoundary>
    </FigureFrame>
  )
}
