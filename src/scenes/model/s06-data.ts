import type { ModelPart } from '@/drawings/types'

/**
 * What S-06 adds to the hero's wide model (views/s06.ts buildS06Model('wide')), precomputed
 * for the s06 scene: the flange the FIXED stall happens at, the monitor gauge, and the three
 * month instruments (stub and enclosure). data.unit.spec.ts asserts it equals the live build.
 */
export const S06_EXTRA = [
  {
    id: 'flange',
    kind: 'flange',
    prims: [{ t: 'circle', c: [480, 362], r: 11 }],
    depth: 22,
    z: 3,
    material: 'aluminum',
    anchor: 'fixed',
  },
  {
    id: 'gauge',
    kind: 'cyl',
    prims: [{ t: 'circle', c: [566, 376], r: 22 }],
    depth: 60,
    material: 'aluminum',
    anchor: 'gauge',
  },
  {
    id: 'm1.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [130, 432],
          [84, 432],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m1'],
  },
  {
    id: 'm1',
    kind: 'box',
    prims: [{ t: 'rect', at: [69, 420], size: [30, 24] }],
    depth: 22,
    material: 'orange',
    anchor: 'add.report',
    revs: ['m1'],
  },
  {
    id: 'm2.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [655, 96],
          [655, 142],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m2'],
  },
  {
    id: 'm2',
    kind: 'box',
    prims: [{ t: 'rect', at: [640, 130], size: [30, 24] }],
    depth: 22,
    material: 'orange',
    anchor: 'add.alert',
    revs: ['m2'],
  },
  {
    id: 'm3.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [305, 96],
          [305, 50],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m3'],
  },
  {
    id: 'm3',
    kind: 'box',
    prims: [{ t: 'rect', at: [290, 38], size: [30, 24] }],
    depth: 22,
    material: 'orange',
    anchor: 'add.automation',
    revs: ['m3'],
  },
] as unknown as readonly ModelPart[]
