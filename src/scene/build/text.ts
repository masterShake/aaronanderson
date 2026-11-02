/**
 * In-world drawing text (room names, sizes, dimensions, tags) as troika SDF text lying flat in
 * plan space, so it foreshortens with the plan and is hidden by framing later. Built once; per
 * frame only clipRect (the typing wipe), colour and visibility change — never layout props.
 */
import { Color, Group, MeshBasicMaterial } from 'three'
import { configureTextBuilder, preloadFont, Text } from 'troika-three-text'
import type { Timeline } from '@/lib/draft/timeline'
import { LABEL_CHARSET } from '@/lib/plan/charset'
import { PALETTE } from '@/lib/plan/pens'
import type { Label, LabelSize, PlanDrawing } from '@/lib/plan/types'

/** Self-hosted, versioned label font (static Archivo Condensed Medium, OFL). */
export const LABEL_FONT = '/fonts/archivo/ArchivoCondensed-Medium.v1.otf'

/** Layout em size in plan inches; on-screen size is set by scaling (no re-layout). */
const BASE_EM = 12

/** Target on-screen em sizes in CSS px: [wide, narrow]. Nothing renders below 10 px. */
export const LABEL_PX: Record<LabelSize, readonly [number, number]> = {
  name: [12, 10],
  size: [10, 10],
  dim: [10, 10],
  tag: [10, 10],
  note: [10, 10],
}

export interface LabelItem {
  label: Label
  text: Text
  t0: number
  t1: number
  final: Color
  color: Color
  synced: boolean
  clip: [number, number, number, number]
}

let configured = false

export function buildLabels(plan: PlanDrawing, tl: Timeline): { group: Group; items: LabelItem[]; ready: Promise<void> } {
  if (!configured) {
    // No CDN fallback: every glyph we use is in the self-hosted font (see LABEL_CHARSET tests).
    configureTextBuilder({ defaultFontURL: LABEL_FONT, sdfGlyphSize: 64 })
    configured = true
  }
  const group = new Group()
  group.name = 'labels'
  const base = new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
  const items: LabelItem[] = []

  const ready = new Promise<void>((resolve) => {
    preloadFont({ font: LABEL_FONT, characters: LABEL_CHARSET, sdfGlyphSize: 64 }, () => {
      let pending = plan.labels.length
      if (!pending) resolve()
      for (const item of items)
        item.text.sync(() => {
          item.synced = true
          const b = item.text.textRenderInfo?.blockBounds
          if (b) item.clip = [b[0], b[1], b[2], b[3]]
          if (--pending === 0) resolve()
        })
    })
  })

  plan.labels.forEach((label, i) => {
    const text = new Text()
    text.text = label.text
    text.font = LABEL_FONT
    text.fontSize = BASE_EM
    text.sdfGlyphSize = 64
    text.anchorX = label.anchor.x
    text.anchorY = label.anchor.y
    text.material = base
    text.position.set(label.at[0], label.at[1], 0)
    text.rotation.z = label.rot === 90 ? Math.PI / 2 : 0
    text.renderOrder = 10
    text.visible = false
    text.frustumCulled = false
    const final = new Color(PALETTE[label.color])
    const color = final.clone()
    text.color = color
    group.add(text)
    items.push({ label, text, t0: tl.labels[i * 2], t1: tl.labels[i * 2 + 1], final, color, synced: false, clip: [0, 0, 0, 0] })
  })

  return { group, items, ready }
}

/** Scale every label so its em is `LABEL_PX` CSS px at the given plan scale. */
export function scaleLabels(items: readonly LabelItem[], pxPerIn: number, wide: boolean): void {
  for (const item of items) {
    const px = LABEL_PX[item.label.size][wide ? 0 : 1]
    item.text.scale.setScalar(px / pxPerIn / BASE_EM)
  }
}
