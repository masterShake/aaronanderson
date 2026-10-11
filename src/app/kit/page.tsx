import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { preview } from '@/content/pages/preview'
import { site } from '@/content/site'
import { glossary, legendSymbols } from '@/content/legend'
import { howItWorks } from '@/content/pages/how-it-works'
import { home } from '@/content/pages/home'
import { about } from '@/content/pages/about'
import { contact } from '@/content/pages/contact'
import { servicesPage } from '@/content/pages/services'
import { notFound as notFoundCopy, errorPage } from '@/content/pages/not-found'
import { services } from '@/content/services'
import { processSteps } from '@/content/process'
import { people } from '@/content/people'
import { proof } from '@/content/proof'
import { heroFigure } from '@/content/figures/hero'
import { heldText, holdRegistry, isHold } from '@/content/hold'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { PATH, serviceHref } from '@/lib/routes'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { SheetLink } from '@/components/chrome/SheetLink.client'
import { Wordmark } from '@/components/chrome/Wordmark'
import { PageHead } from '@/components/blueprint/PageHead'
import { SheetHeader } from '@/components/blueprint/SheetHeader'
import { SheetTab } from '@/components/blueprint/SheetTab'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { SectionCut } from '@/components/blueprint/SectionCut'
import { Callout } from '@/components/blueprint/Callout'
import { DimensionLine } from '@/components/blueprint/DimensionLine'
import { DimensionChain } from '@/components/blueprint/DimensionChain'
import { ScaleBar } from '@/components/blueprint/ScaleBar'
import { NorthArrow } from '@/components/blueprint/NorthArrow'
import { Stamp } from '@/components/blueprint/Stamp'
import { SpecGrid } from '@/components/blueprint/SpecGrid'
import { PunchList } from '@/components/blueprint/PunchList'
import { Schedule } from '@/components/blueprint/Schedule'
import { SheetIndexTable } from '@/components/blueprint/SheetIndexTable'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'
import { RevisionTable } from '@/components/blueprint/RevisionTable'
import { LegendTable } from '@/components/blueprint/LegendTable'
import { HoldChip } from '@/components/blueprint/HoldChip'
import { HoldCloud } from '@/components/blueprint/HoldCloud'
import { ConfirmMark } from '@/components/blueprint/ConfirmMark'
import { CtaBand } from '@/components/blueprint/CtaBand'
import { Button } from '@/components/ui/Button'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { TextLink } from '@/components/ui/TextLink'
import { MotionSwitch } from '@/components/ui/MotionSwitch'
import { CopyEmail } from '@/components/ui/CopyEmail.client'
import { RichText } from '@/components/ui/RichText'
import { HeldText } from '@/components/ui/HeldText'
import { Claimed } from '@/components/ui/Claimed'
import { VisuallyHidden } from '@/components/ui/VisuallyHidden'
import { NotFoundFigure } from '@/figures/not-found/NotFoundFigure'
import { ToggleDemo } from './ToggleDemo.client'
import s from './kit.module.css'

export const metadata: Metadata = pageMetadata('kit')

/** One kit section: an H2 from content, then the specimens. */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`kit-${id}`} aria-labelledby={`kit-${id}-title`} className={`${s.group} wrap`}>
      <h2 id={`kit-${id}-title`} className={s.groupTitle}>
        {title}
      </h2>
      <div className={s.specimens}>{children}</div>
    </section>
  )
}

/** A labelled specimen cell; the label is the component's own copy, never invented. */
function Cell({ children, dark, wide }: { children: ReactNode; dark?: boolean; wide?: boolean }) {
  return (
    <div className={`${s.cell} ${dark ? `${s.dark} on-dark` : ''} ${wide ? s.wide : ''}`}>
      {children}
    </div>
  )
}

/**
 * Preview only: the design-system sheet. Every chrome, UI and blueprint
 * component in its states, built from real content (nothing invented).
 * Production returns 404; preview is noindex (pageMetadata('kit')).
 */
export default function KitPage() {
  if (!PREVIEW_PAGES) notFound()
  const c = preview.kit
  const firstService = services[0]!
  const scheduleRows = services.map((sv) => ({
    sheet: sv.id,
    service: sv.name,
    length: sv.lengthLabel,
    pairedWith: sv.pairedWith.join(' · '),
  }))
  const holds = holdRegistry().filter(isHold).slice(0, 6)
  const photo = people.people[0]?.photo
  return (
    <SheetTransition>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={c.h1} deck={c.deck} />

      <Group id="chrome" title={site.header.navLabel}>
        <Cell>
          <Wordmark size="header" mark />
          <Wordmark size="header" />
        </Cell>
        <Cell dark>
          <Wordmark size="footer" mark />
        </Cell>
        <Cell>
          <SheetHeader
            sheet="S-00"
            title={site.nav[1]!.sheetTitle}
            scale={site.sheet.scale}
            rev={processSteps[0]!.stamp}
          />
          <SheetLink href={PATH.services}>{site.nav[1]!.label}</SheetLink>
        </Cell>
        <Cell>
          <SheetTab id="S-01" />
          <SheetTab id="P-05" />
        </Cell>
      </Group>

      <Group id="buttons" title={site.cta.book}>
        <Cell>
          <BookCallButton />
          <BookCallButton size="lg" sheet="S-02" />
        </Cell>
        <Cell>
          <Button variant="secondary">{errorPage.retry}</Button>
          <Button variant="secondary" size="lg" href={PATH.contact}>
            {site.nav[4]!.label}
          </Button>
          <Button variant="text" href={home.hero.seeDrawing.href}>
            {home.hero.seeDrawing.label}
          </Button>
        </Cell>
        <Cell dark>
          <BookCallButton />
          <Button variant="secondary">{errorPage.retry}</Button>
        </Cell>
        <Cell>
          <TextLink href={PATH.about}>{site.nav[3]!.label}</TextLink>
          <TextLink href={site.url} external>
            {site.name}
          </TextLink>
        </Cell>
      </Group>

      <Group id="motion" title={site.motion.label}>
        <Cell>
          <MotionSwitch variant="header" label={site.motion.label} />
          <MotionSwitch variant="strip" label={site.motion.label} />
          <MotionSwitch variant="menu" label={site.motion.label} />
        </Cell>
        <Cell dark>
          <MotionSwitch variant="footer" label={site.motion.label} />
        </Cell>
        <Cell>
          <ToggleDemo
            label={about.orgChart.toggle.label}
            options={[
              { value: 'usual', label: about.orgChart.toggle.usual },
              { value: 'ours', label: about.orgChart.toggle.ours },
            ]}
          />
        </Cell>
        <Cell>
          <CopyEmail
            email={heldText(site.email) ?? site.name}
            copy={contact.email.copy}
            copied={contact.email.copied}
            live={contact.email.copiedLive}
            failed={contact.email.copyFailed}
          />
        </Cell>
      </Group>

      <Group id="holds" title={preview.punchList.h1}>
        <Cell>
          <p>
            <HeldText value={site.callLength} />
          </p>
          <p>
            <HoldChip hold={proof.logos} />
          </p>
          <RichText value={contact.closing.body} />
        </Cell>
        <Cell dark>
          <p>
            <HeldText value={site.location} />
          </p>
        </Cell>
        <Cell>{photo && isHold(photo) ? <HoldCloud hold={photo} kind="photo" /> : null}</Cell>
        <Cell>
          <HoldCloud hold={proof.logos} kind="logo" />
          <HoldCloud hold={proof.testimonials[0]!} kind="quote" />
        </Cell>
        <Cell>
          <HoldCloud hold={proof.caseStudies[0]!} kind="block" minHeight={160} />
          <HoldCloud hold={proof.caseStudies[1]!} kind="stat" />
        </Cell>
        <Cell>
          {about.notes.items.slice(0, 2).map((it) => (
            <p key={it.id}>
              <Claimed value={it}>{(text) => text}</Claimed>
            </p>
          ))}
          <p>
            <ConfirmMark id={about.notes.items[0]!.id}>{about.notes.h2}</ConfirmMark>
          </p>
        </Cell>
        <Cell wide>
          <PunchList
            items={holds.map((h, i) => ({ text: h.note, done: i === 0 && !h.essential }))}
          />
        </Cell>
      </Group>

      <Group id="type" title={servicesPage.sheet.plainTerms}>
        <Cell wide>
          <p className="label">{home.hero.eyebrow.full}</p>
          <p className={s.h1Sample}>{home.hero.h1}</p>
          <p className="hand">{home.hero.signoff}</p>
          <RichText value={home.hero.deck} className="lead" />
          <RichText value={firstService.examples[0]!} />
          <RichText value={services[1]!.plainTerms ?? services[1]!.promise} />
          <VisuallyHidden>{site.skipLink}</VisuallyHidden>
        </Cell>
        <Cell>
          <SectionHead id="kit-section" h2={home.wiring.h2} body={[home.wiring.kicker]} />
          <SectionHead
            id="kit-sub"
            h2={firstService.name}
            level={3}
            body={[firstService.promise]}
          />
        </Cell>
      </Group>

      <Group id="marks" title={howItWorks.control.h2}>
        <Cell>
          {processSteps.map((p) => (
            <Stamp key={p.id} text={p.stamp} />
          ))}
          <Stamp text={processSteps[0]!.stamp} tone="redline" live />
        </Cell>
        <Cell>
          <Callout variant="note">{home.wiring.kicker}</Callout>
          <Callout variant="machine">{site.exampleTag}</Callout>
          <Callout variant="redline">{notFoundCopy.body}</Callout>
          <Callout variant="detail-ref" href={PATH.home}>
            {heroFigure.detail}
          </Callout>
        </Cell>
        <Cell>
          <NorthArrow label={site.titleBlock.northArrow} href="#main" variant="top" />
          <NorthArrow label={home.sheetIndex.startHere} href="#kit-tables" variant="start-here" />
          <ScaleBar />
        </Cell>
        <Cell wide>
          <SectionCut letter="A" sheet="P-00" id="kit-cut" />
        </Cell>
      </Group>

      <Group id="dimensions" title={home.process.h2}>
        <Cell wide>
          {services.map((sv) =>
            'weeks' in sv.shape.span ? (
              <DimensionLine
                key={sv.id}
                scale={[0, 8]}
                span={sv.shape.span.weeks}
                extendTo={sv.shape.span.weeks[1] + 1}
                label={sv.lengthLabel}
                variant={sv.id === 'S-03' ? 'range' : 'solid'}
                ends={sv.id === 'S-02' ? 'arrows' : 'ticks'}
              />
            ) : (
              <DimensionLine
                key={sv.id}
                scale={[0, 8]}
                span={[0, 8]}
                label={sv.lengthLabel}
                variant={'sessions' in sv.shape.span ? 'dots' : 'ticks'}
              />
            ),
          )}
        </Cell>
        <Cell wide>
          <DimensionChain
            steps={processSteps.map((p) => ({
              label: p.name,
              length: heldText(p.howLong) ?? p.name,
              you: p.youShort,
            }))}
          />
        </Cell>
        <Cell wide>
          <SpecGrid
            cells={[
              { label: howItWorks.spec.weDo, value: <RichText value={processSteps[0]!.weDo} /> },
              { label: howItWorks.spec.youDo, value: <RichText value={processSteps[0]!.youDo} /> },
              {
                label: howItWorks.spec.howLong,
                value: <HeldText value={processSteps[0]!.howLong} />,
              },
              {
                label: howItWorks.spec.youGet,
                value: <RichText value={processSteps[0]!.youGet} />,
              },
            ]}
          />
        </Cell>
      </Group>

      <Group id="tables" title={home.sheetIndex.h2}>
        <Cell wide>
          <SheetIndexTable
            caption={home.sheetIndex.caption}
            columns={home.sheetIndex.columns}
            startHere={home.sheetIndex.startHere}
            rows={services.map((sv) => ({
              sheet: sv.id,
              service: sv.name,
              walkAway: sv.walkAwayWith,
              length: sv.lengthLabel,
              href: serviceHref(sv.id),
            }))}
          />
        </Cell>
        <Cell wide>
          <Schedule
            caption={servicesPage.schedule.caption}
            stack
            columns={[
              { key: 'sheet', label: servicesPage.schedule.columns.sheet },
              { key: 'service', label: servicesPage.schedule.columns.service },
              { key: 'length', label: servicesPage.schedule.columns.length },
              { key: 'pairedWith', label: servicesPage.schedule.columns.pairedWith },
            ]}
            rows={scheduleRows}
          />
        </Cell>
        <Cell wide>
          <RevisionTable
            caption={howItWorks.revTable.caption}
            columns={howItWorks.revTable.columns}
            rows={processSteps.map((p) => [p.id.slice(-1), p.name, p.rev.change, p.rev.approvedBy])}
          />
        </Cell>
        <Cell>
          <GeneralNotes title={site.titleBlock.notes.title} items={about.notes.items} />
        </Cell>
        <Cell dark>
          <GeneralNotes title={site.titleBlock.notes.title} items={site.titleBlock.notes.items} />
        </Cell>
      </Group>

      <Group id="legend" title={howItWorks.legend.h2}>
        <Cell wide>
          <LegendTable
            symbols={legendSymbols.slice(0, 4)}
            glossary={glossary.slice(0, 3)}
            columns={howItWorks.legend.columns}
            captions={{
              symbols: howItWorks.legend.symbolsCaption,
              glossary: howItWorks.legend.glossaryCaption,
            }}
            compact
          />
        </Cell>
      </Group>

      <Group id="figure" title={notFoundCopy.h1}>
        <Cell wide>
          <NotFoundFigure />
        </Cell>
      </Group>

      <CtaBand content={home.closing} />
    </SheetTransition>
  )
}
