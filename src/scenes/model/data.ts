import type { LayoutId } from '@/drawings/types'
import type { HeroSceneData } from './spec'

/**
 * The firm model, precomputed for the hero scene (C5): buildHeroSceneData('wide' | 'tall'),
 * so the scene chunk carries data instead of lib/route and lib/frame. data.unit.spec.ts
 * asserts it equals the live build; regenerate with GEN_OUT (see that spec) after any change
 * to views/hero.ts or model/spec.ts. The cut-out symbols are the same in both families.
 */

const SYMBOLS = {
  'fig.at-valve': [
    'M15 22L17 33L19 34L20 32L18 21L16 20ZM17 33L23 42L25 43L25 41L20 32L18 31Z',
    'M16 40L14 56L16 58L18 56L20 40L18 38ZM14 56L13 71L15 72L16 71L18 56L16 55ZM13 69L16 69L20 72L13 72Z',
    'M13 20L27 20L25 38L26 41L14 41L15 38Z',
    'M20 40L23 56L25 58L27 55L24 40L22 38ZM23 56L25 71L27 72L28 71L27 56L25 54ZM25 69L28 69L31 72L25 72Z',
    'M24 13L23 15L22 17L21 17L19 17L18 17L17 15L16 13L17 11L18 9L19 9L21 9L22 9L23 11Z',
    'M23 23L33 28L35 27L34 25L24 20L22 21ZM33 28L43 31L45 30L44 28L34 25L32 26Z',
  ],
  'fig.tablet': [
    'M15 22L18 33L20 34L21 32L18 21L16 20ZM19 34L30 33L31 32L30 31L19 31L18 32Z',
    'M16 40L15 56L17 58L19 56L21 40L18 38ZM15 56L15 71L17 72L18 71L19 56L17 55ZM15 69L18 69L22 72L15 72Z',
    'M13 20L27 20L25 38L26 41L14 41L15 38Z',
    'M20 40L21 56L23 58L25 56L24 40L22 38ZM21 56L22 71L24 72L25 71L25 56L23 55ZM22 69L25 69L29 72L22 72Z',
    'M24 13L23 15L22 17L21 17L19 17L18 17L17 15L16 13L17 11L18 9L19 9L21 9L22 9L23 11Z',
    'M22 22L26 32L28 33L29 31L25 21L23 20ZM28 33L38 30L39 29L38 28L27 30L26 32Z',
    'M37 21H43V30H37Z',
  ],
  'fig.phone': [
    'M15 22L16 33L17 34L19 32L18 21L16 20ZM16 33L18 44L19 45L20 43L19 32L17 31Z',
    'M16 40L15 56L17 58L19 56L21 40L18 38ZM15 56L15 71L16 72L18 71L19 56L17 55ZM15 69L18 69L21 72L15 72Z',
    'M13 20L27 20L25 38L26 41L14 41L15 38Z',
    'M20 40L21 56L24 58L25 56L24 40L22 38ZM21 56L23 71L24 72L26 71L25 56L23 55ZM23 69L26 69L29 72L23 72Z',
    'M24 13L23 15L22 17L21 17L19 17L18 17L17 15L16 13L17 11L18 9L19 9L21 9L22 9L23 11Z',
    'M22 21L18 31L19 33L21 32L25 22L24 20ZM21 33L28 24L28 22L26 23L19 31L19 33Z',
    'M23 12H26V17H23Z',
  ],
}

const CORE = {
  wide: {
    spec: {
      id: 'hero-wide',
      layout: 'wide',
      viewBox: [0, 0, 960, 640],
      start: 'plan',
      parts: [
        {
          id: 'crm',
          kind: 'box',
          prims: [{ t: 'rect', at: [30, 60], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.crm',
        },
        {
          id: 'estimate',
          kind: 'box',
          prims: [{ t: 'rect', at: [380, 60], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.estimate',
        },
        {
          id: 'inbox',
          kind: 'box',
          prims: [{ t: 'rect', at: [30, 508], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.inbox',
        },
        {
          id: 'pm',
          kind: 'box',
          prims: [{ t: 'rect', at: [730, 60], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.pm',
        },
        {
          id: 'accounting',
          kind: 'box',
          prims: [{ t: 'rect', at: [380, 508], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.accounting',
        },
        {
          id: 'report',
          kind: 'box',
          prims: [{ t: 'rect', at: [730, 284], size: [200, 72] }],
          depth: 44,
          material: 'orange',
          anchor: 'tool.report',
        },
        {
          id: 'field',
          kind: 'box',
          prims: [{ t: 'rect', at: [30, 284], size: [200, 72] }],
          depth: 44,
          material: 'aluminum',
          anchor: 'tool.field',
        },
        {
          id: 'store',
          kind: 'tank',
          prims: [{ t: 'circle', c: [480, 320], r: 42 }],
          depth: 96,
          material: 'aluminum',
          anchor: 'sym.store',
        },
        {
          id: 'r01',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [130, 356],
                [130, 508],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r02',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [230, 544],
                [380, 544],
              ],
              r: 12,
            },
            {
              t: 'poly',
              pts: [
                [297.5, 544],
                [297.5, 516],
                [357.5, 516],
                [357.5, 544],
              ],
              r: 6,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r03',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [230, 526],
                [305, 526],
                [305, 205],
                [800, 205],
                [800, 132],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r04',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [760, 132],
                [760, 211],
                [311, 211],
                [311, 320],
                [230, 320],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r05',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [580, 96],
                [730, 96],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r06',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [900, 132],
                [900, 199],
                [655, 199],
                [655, 544],
                [580, 544],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r08',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [480, 508],
                [480, 362],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r09',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [850, 132],
                [850, 217],
                [661, 217],
                [661, 193],
                [480, 193],
                [480, 278],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r10',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [522, 320],
                [730, 320],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'r11',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [230, 96],
                [380, 96],
              ],
              r: 12,
            },
          ],
          depth: 9,
          z: 9.5,
          material: 'aluminum',
        },
        {
          id: 'ai',
          kind: 'cyl',
          prims: [{ t: 'circle', c: [267.5, 544], r: 15 }],
          depth: 22,
          material: 'aluminum',
          anchor: 'sym.ai',
        },
        {
          id: 'valve',
          kind: 'valve',
          prims: [
            {
              t: 'poly',
              pts: [
                [312.5, 507],
                [327.5, 516],
                [312.5, 525],
              ],
              closed: true,
            },
            {
              t: 'poly',
              pts: [
                [342.5, 507],
                [327.5, 516],
                [342.5, 525],
              ],
              closed: true,
            },
          ],
          depth: 18,
          material: 'orange',
          anchor: 'sym.valve',
        },
      ],
    },
    people: [
      { id: 'p1', symbol: 'fig.at-valve', at: [352, 504] },
      { id: 'p2', symbol: 'fig.tablet', at: [618, 186] },
      { id: 'p3', symbol: 'fig.phone', at: [222, 482] },
    ],
    person: 60,
  },
  tall: {
    spec: {
      id: 'hero-tall',
      layout: 'tall',
      viewBox: [0, 0, 400, 480],
      start: 'plan',
      parts: [
        {
          id: 'estimate',
          kind: 'box',
          prims: [{ t: 'rect', at: [20, 28], size: [150, 48] }],
          depth: 30,
          material: 'aluminum',
          anchor: 'tool.estimate',
        },
        {
          id: 'inbox',
          kind: 'box',
          prims: [{ t: 'rect', at: [20, 288], size: [150, 48] }],
          depth: 30,
          material: 'aluminum',
          anchor: 'tool.inbox',
        },
        {
          id: 'pm',
          kind: 'box',
          prims: [{ t: 'rect', at: [230, 28], size: [150, 48] }],
          depth: 30,
          material: 'aluminum',
          anchor: 'tool.pm',
        },
        {
          id: 'accounting',
          kind: 'box',
          prims: [{ t: 'rect', at: [230, 288], size: [150, 48] }],
          depth: 30,
          material: 'aluminum',
          anchor: 'tool.accounting',
        },
        {
          id: 'report',
          kind: 'box',
          prims: [{ t: 'rect', at: [230, 148], size: [150, 48] }],
          depth: 30,
          material: 'orange',
          anchor: 'tool.report',
        },
        {
          id: 'field',
          kind: 'box',
          prims: [{ t: 'rect', at: [20, 148], size: [150, 48] }],
          depth: 30,
          material: 'aluminum',
          anchor: 'tool.field',
        },
        {
          id: 'store',
          kind: 'tank',
          prims: [{ t: 'circle', c: [305, 428], r: 32 }],
          depth: 70,
          material: 'aluminum',
          anchor: 'sym.store',
        },
        {
          id: 'r01',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [95, 196],
                [95, 288],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r02',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [170, 312],
                [230, 312],
              ],
              r: 10,
            },
            {
              t: 'poly',
              pts: [
                [197, 312],
                [197, 284],
                [221, 284],
                [221, 312],
              ],
              r: 5,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r03',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [170, 300],
                [200, 300],
                [200, 112],
                [282.5, 112],
                [282.5, 76],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r04',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [252.5, 76],
                [252.5, 118],
                [206, 118],
                [206, 172],
                [170, 172],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r05',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [170, 52],
                [230, 52],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r06',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [380, 52],
                [390, 52],
                [390, 312],
                [380, 312],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r08',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [305, 336],
                [305, 396],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r09',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [357.5, 76],
                [357.5, 106],
                [384, 106],
                [384, 428],
                [337, 428],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'r10',
          kind: 'pipe',
          prims: [
            {
              t: 'poly',
              pts: [
                [273, 428],
                [194, 428],
                [194, 172],
                [230, 172],
              ],
              r: 10,
            },
          ],
          depth: 7,
          z: 7.5,
          material: 'aluminum',
        },
        {
          id: 'ai',
          kind: 'cyl',
          prims: [{ t: 'circle', c: [185, 312], r: 11 }],
          depth: 16,
          material: 'aluminum',
          anchor: 'sym.ai',
        },
        {
          id: 'valve',
          kind: 'valve',
          prims: [
            {
              t: 'poly',
              pts: [
                [197, 277],
                [209, 284],
                [197, 291],
              ],
              closed: true,
            },
            {
              t: 'poly',
              pts: [
                [221, 277],
                [209, 284],
                [221, 291],
              ],
              closed: true,
            },
          ],
          depth: 14,
          material: 'orange',
          anchor: 'sym.valve',
        },
      ],
    },
    people: [
      { id: 'p1', symbol: 'fig.at-valve', at: [238, 280] },
      { id: 'p2', symbol: 'fig.tablet', at: [152, 142] },
      { id: 'p3', symbol: 'fig.phone', at: [140, 280] },
    ],
    person: 42,
  },
}

export const HERO_DATA = {
  wide: { ...CORE.wide, symbols: SYMBOLS },
  tall: { ...CORE.tall, symbols: SYMBOLS },
} as unknown as Readonly<Record<LayoutId, HeroSceneData>>
