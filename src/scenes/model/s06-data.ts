import type { ModelPart } from '@/drawings/types'

/**
 * What S-06 adds to the hero's wide model (views/s06.ts buildS06Model('wide')), precomputed
 * for the s06 scene: the flange the FIXED stall happens at, the monitor gauge, and the three
 * month instruments (stub and puck). data.unit.spec.ts asserts it equals the live build.
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
    prims: [{ t: 'circle', c: [566, 376], r: 18 }],
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
    kind: 'cyl',
    prims: [{ t: 'circle', c: [84, 432], r: 14 }],
    depth: 16,
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
    kind: 'cyl',
    prims: [{ t: 'circle', c: [655, 142], r: 14 }],
    depth: 16,
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
          [626, 320],
          [626, 366],
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
    kind: 'cyl',
    prims: [{ t: 'circle', c: [626, 366], r: 14 }],
    depth: 16,
    material: 'orange',
    anchor: 'add.automation',
    revs: ['m3'],
  },
] as unknown as readonly ModelPart[]
