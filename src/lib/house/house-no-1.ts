/**
 * House No. 1 — a single-storey, 48′-0″ × 32′-0″, three-bedroom, two-bath house over a
 * crawlspace. Front faces south (the bottom of the drawing).
 *
 * All values are inches and multiples of 1/16″ (see `validateHouse`). Walls are bottom-plate
 * rectangles in stud coordinates; rooms and fixtures are finished rectangles (stud face ± ½″).
 * Bedrooms open off one hall to the west; both baths and the laundry share the 2x6 wet wall
 * at x = 247; the great room and kitchen take the east half.
 */
import type { HouseSpec } from '@/lib/house/types'

const EGRESS_CASEMENT = { op: 'casement', w: 36, h: 54, netClear: [31, 49] } as const

export const HOUSE_NO_1: HouseSpec = {
  meta: {
    name: 'HOUSE NO. 1',
    sheet: 'A-101',
    drawing: 'FLOOR PLAN',
    scale: '1/4″ = 1′-0″',
    date: '2026-11-01',
  },
  footprint: [0, 0, 576, 384],
  datums: { floor: 0, plate: 109.125, grade: -30, porchDeck: -7.5 },
  foundation: { kind: 'crawlspace' },
  assemblies: {
    'ext-2x6': {
      stud: '2x6',
      depth: 5.5,
      spacing: 16,
      topPlates: 2,
      layers: [
        { side: 'out', name: '7/16 OSB sheathing', t: 0.4375 },
        { side: 'out', name: 'lap siding', t: 0.625 },
        { side: 'in', name: '1/2 gypsum board', t: 0.5 },
      ],
    },
    'int-2x4': {
      stud: '2x4',
      depth: 3.5,
      spacing: 16,
      topPlates: 2,
      layers: [
        { side: 'out', name: '1/2 gypsum board', t: 0.5 },
        { side: 'in', name: '1/2 gypsum board', t: 0.5 },
      ],
    },
    'int-2x6': {
      stud: '2x6',
      depth: 5.5,
      spacing: 16,
      topPlates: 2,
      layers: [
        { side: 'out', name: '1/2 gypsum board', t: 0.5 },
        { side: 'in', name: '1/2 gypsum board', t: 0.5 },
      ],
    },
  },

  walls: [
    // Exterior: south and north run through; east and west butt between them.
    { id: 'ext-s', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 0, 576, 5.5] },
    { id: 'ext-e', kind: 'exterior', assembly: 'ext-2x6', rect: [570.5, 5.5, 576, 378.5] },
    { id: 'ext-n', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 378.5, 576, 384] },
    { id: 'ext-w', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 5.5, 5.5, 378.5] },
    // Hall (centrelines y 156 and y 198, 38½″ between studs).
    { id: 'hall-s', kind: 'interior', assembly: 'int-2x4', rect: [5.5, 154.25, 313.75, 157.75] },
    { id: 'hall-n', kind: 'interior', assembly: 'int-2x4', rect: [5.5, 196.25, 313.75, 199.75] },
    // South of the hall: bedrooms 2 and 3 with back-to-back closets.
    { id: 'bed2-bed3', kind: 'interior', assembly: 'int-2x4', rect: [154.25, 5.5, 157.75, 154.25] },
    { id: 'bed3-great', kind: 'interior', assembly: 'int-2x4', rect: [310.25, 5.5, 313.75, 154.25] },
    { id: 'clo2-front', kind: 'interior', assembly: 'int-2x4', rect: [125.75, 78.75, 129.25, 154.25] },
    { id: 'clo2-end', kind: 'interior', assembly: 'int-2x4', rect: [129.25, 78.75, 154.25, 82.25] },
    { id: 'clo3-front', kind: 'interior', assembly: 'int-2x4', rect: [182.75, 78.75, 186.25, 154.25] },
    { id: 'clo3-end', kind: 'interior', assembly: 'int-2x4', rect: [157.75, 78.75, 182.75, 82.25] },
    // North of the hall: primary suite, baths on the wet wall, laundry.
    { id: 'primary-e', kind: 'interior', assembly: 'int-2x4', rect: [160.25, 199.75, 163.75, 378.5] },
    { id: 'wet', kind: 'interior', assembly: 'int-2x6', rect: [244.25, 199.75, 249.75, 378.5] },
    { id: 'laundry-great', kind: 'interior', assembly: 'int-2x4', rect: [310.25, 199.75, 313.75, 378.5] },
    { id: 'bath-wic', kind: 'interior', assembly: 'int-2x4', rect: [163.75, 298.25, 244.25, 301.75] },
    { id: 'bath2-laundry', kind: 'interior', assembly: 'int-2x4', rect: [249.75, 298.25, 310.25, 301.75] },
  ],

  openings: [
    // Windows, numbered counter-clockwise from the SW corner.
    { id: 'W01', kind: 'window', tag: 1, wall: 'ext-s', at: 72, ...EGRESS_CASEMENT },
    { id: 'W02', kind: 'window', tag: 2, wall: 'ext-s', at: 234, ...EGRESS_CASEMENT },
    { id: 'W03', kind: 'window', tag: 3, wall: 'ext-s', at: 432, op: 'single-hung', w: 36, h: 54 },
    { id: 'W04', kind: 'window', tag: 4, wall: 'ext-s', at: 504, op: 'single-hung', w: 36, h: 54 },
    { id: 'W05', kind: 'window', tag: 5, wall: 'ext-e', at: 96, op: 'single-hung', w: 36, h: 54 },
    { id: 'W06', kind: 'window', tag: 6, wall: 'ext-n', at: 480, op: 'casement', w: 36, h: 36 },
    { id: 'W07', kind: 'window', tag: 7, wall: 'ext-n', at: 84, ...EGRESS_CASEMENT },
    { id: 'W08', kind: 'window', tag: 8, wall: 'ext-w', at: 289, ...EGRESS_CASEMENT },
    { id: 'W09', kind: 'window', tag: 9, wall: 'ext-w', at: 177, op: 'fixed', w: 24, h: 36 },
    { id: 'W10', kind: 'window', tag: 10, wall: 'ext-w', at: 80, ...EGRESS_CASEMENT },
    // Exterior doors.
    { id: 'D01', kind: 'door', op: 'swing', exterior: true, wall: 'ext-s', at: 336, w: 36, h: 80, hinge: 'lo', side: 'hi' },
    { id: 'D02', kind: 'door', op: 'slider', exterior: true, wall: 'ext-e', at: 210, w: 72, h: 80 },
    // Interior doors.
    { id: 'D03', kind: 'door', op: 'swing', wall: 'hall-s', at: 105, w: 32, h: 80, hinge: 'hi', side: 'lo' },
    { id: 'D04', kind: 'door', op: 'swing', wall: 'hall-s', at: 207, w: 32, h: 80, hinge: 'lo', side: 'lo' },
    { id: 'D05', kind: 'door', op: 'bypass', wall: 'clo2-front', at: 118.25, w: 60, h: 80 },
    { id: 'D06', kind: 'door', op: 'bypass', wall: 'clo3-front', at: 118.25, w: 60, h: 80 },
    { id: 'D07', kind: 'door', op: 'swing', wall: 'hall-n', at: 139, w: 32, h: 80, hinge: 'hi', side: 'hi' },
    { id: 'D08', kind: 'door', op: 'swing', wall: 'primary-e', at: 278, w: 30, h: 80, hinge: 'lo', side: 'hi' },
    { id: 'D09', kind: 'door', op: 'swing', wall: 'primary-e', at: 323, w: 32, h: 80, hinge: 'hi', side: 'hi' },
    { id: 'D10', kind: 'door', op: 'swing', wall: 'hall-n', at: 288, w: 30, h: 80, hinge: 'hi', side: 'hi' },
    { id: 'D11', kind: 'door', op: 'swing', wall: 'laundry-great', at: 323, w: 32, h: 80, hinge: 'lo', side: 'lo' },
  ],

  rooms: [
    { id: 'bed2', name: 'BEDROOM 2', use: 'bedroom', rect: [6, 6, 153.75, 153.75], cut: [[125.25, 78.25, 153.75, 153.75]], label: [66, 64], size: true },
    { id: 'bed3', name: 'BEDROOM 3', use: 'bedroom', rect: [158.25, 6, 309.75, 153.75], cut: [[158.25, 78.25, 186.75, 153.75]], label: [248, 64], size: true },
    { id: 'clo2', name: 'CLOSET', use: 'closet', rect: [129.75, 82.75, 153.75, 153.75], unlabeled: true },
    { id: 'clo3', name: 'CLOSET', use: 'closet', rect: [158.25, 82.75, 182.25, 153.75], unlabeled: true },
    { id: 'hall', name: 'HALL', use: 'hall', rect: [6, 158.25, 313.75, 195.75], label: [100, 177], lod: 2 },
    { id: 'primary', name: 'PRIMARY', use: 'bedroom', rect: [6, 200.25, 159.75, 378], label: [83, 300], size: true },
    { id: 'bath1', name: 'BATH 1', use: 'bath', rect: [164.25, 200.25, 243.75, 297.75], label: [182, 249], lod: 2 },
    { id: 'wic', name: 'W.I.C.', use: 'closet', rect: [164.25, 302.25, 243.75, 378], label: [196, 336], lod: 2 },
    { id: 'bath2', name: 'BATH 2', use: 'bath', rect: [250.25, 200.25, 309.75, 297.75], label: [294, 248], lod: 2 },
    { id: 'laundry', name: 'LAUNDRY', use: 'laundry', rect: [250.25, 302.25, 309.75, 378], label: [280, 336], lod: 2 },
    { id: 'great', name: 'GREAT ROOM', use: 'living', rect: [314.25, 6, 570, 258], label: [442, 120], size: true },
    { id: 'kitchen', name: 'KITCHEN', use: 'kitchen', rect: [354, 258, 570, 378], label: [486, 333], size: true },
    { id: 'porch', name: 'PORCH', use: 'porch', rect: [288, -72, 576, 0], label: [432, -52] },
  ],

  fixtures: [
    // Kitchen north run, west to east: pantry, REF, base, DW, sink, base, range, base.
    { id: 'kitchen.pantry', kind: 'tall-cab', room: 'kitchen', rect: [354, 354, 378, 378], z: [0, 96], facing: 'S' },
    { id: 'kitchen.fridge', kind: 'fridge', room: 'kitchen', rect: [378, 348, 414, 378], z: [0, 70], facing: 'S' },
    { id: 'kitchen.counter', kind: 'counter', room: 'kitchen', rect: [414, 354, 570, 378], z: [0, 36], facing: 'S', wall: 'ext-n' },
    { id: 'kitchen.dw', kind: 'dw', room: 'kitchen', rect: [438, 354, 462, 378], z: [0, 34], facing: 'S' },
    { id: 'kitchen.sink', kind: 'sink-double', room: 'kitchen', rect: [463, 357, 497, 376], z: [26, 36], facing: 'S' },
    { id: 'kitchen.range', kind: 'range', room: 'kitchen', rect: [516, 354, 546, 378], z: [0, 36], facing: 'S' },
    { id: 'kitchen.island', kind: 'island', room: 'kitchen', rect: [432, 270, 528, 312], z: [0, 36], facing: 'N' },
    { id: 'kitchen.upper-1', kind: 'wall-cab', room: 'kitchen', rect: [378, 354, 414, 378], z: [70, 96], facing: 'S' },
    { id: 'kitchen.upper-2', kind: 'wall-cab', room: 'kitchen', rect: [414, 366, 462, 378], z: [54, 96], facing: 'S' },
    { id: 'kitchen.upper-3', kind: 'wall-cab', room: 'kitchen', rect: [498, 366, 570, 378], z: [54, 96], facing: 'S' },
    // Bath 1 (primary): shower across the south end, WC on the wet wall, vanity in the NE corner.
    { id: 'bath1.shower', kind: 'shower', room: 'bath1', rect: [164.25, 200.25, 243.75, 236.25], z: [0, 84], facing: 'N', wall: 'wet' },
    { id: 'bath1.wc', kind: 'wc', room: 'bath1', rect: [215.75, 246, 243.75, 266], z: [0, 30], facing: 'W', wall: 'wet' },
    { id: 'bath1.vanity', kind: 'vanity', room: 'bath1', rect: [201.75, 275.75, 243.75, 297.75], z: [0, 34], facing: 'S', wall: 'bath-wic', sinks: 1 },
    // Bath 2: tub across the north end (set against the studs), vanity and WC on the wet wall.
    { id: 'bath2.tub', kind: 'tub', room: 'bath2', rect: [249.75, 267.75, 309.75, 297.75], z: [0, 16], facing: 'S', wall: 'wet' },
    { id: 'bath2.vanity', kind: 'vanity', room: 'bath2', rect: [250.25, 204, 271.25, 234], z: [0, 34], facing: 'E', wall: 'wet', sinks: 1 },
    { id: 'bath2.wc', kind: 'wc', room: 'bath2', rect: [250.25, 242, 278.25, 262], z: [0, 30], facing: 'E', wall: 'wet' },
    // Laundry.
    { id: 'laundry.washer', kind: 'washer', room: 'laundry', rect: [251, 348, 278, 378], z: [0, 38], facing: 'S', wall: 'ext-n' },
    { id: 'laundry.dryer', kind: 'dryer', room: 'laundry', rect: [280, 348, 307, 378], z: [0, 38], facing: 'S', wall: 'ext-n' },
    { id: 'laundry.wh', kind: 'water-heater', room: 'laundry', rect: [250.25, 306, 260.25, 324], z: [40, 70], facing: 'E', wall: 'wet' },
    // Closet shelves and rods.
    { id: 'clo2.rod', kind: 'shelf-rod', room: 'clo2', rect: [129.75, 82.75, 153.75, 153.75], z: [66, 84], facing: 'W' },
    { id: 'clo3.rod', kind: 'shelf-rod', room: 'clo3', rect: [158.25, 82.75, 182.25, 153.75], z: [66, 84], facing: 'E' },
    { id: 'wic.rod-n', kind: 'shelf-rod', room: 'wic', rect: [164.25, 354, 243.75, 378], z: [66, 84], facing: 'S' },
    { id: 'wic.rod-e', kind: 'shelf-rod', room: 'wic', rect: [219.75, 302.25, 243.75, 354], z: [66, 84], facing: 'W' },
  ],

  // Smoke alarms (IRC R314): every bedroom plus the hall outside them.
  devices: [
    { id: 'alarm.bed2', kind: 'smoke-alarm', room: 'bed2', at: [66, 116] },
    { id: 'alarm.bed3', kind: 'smoke-alarm', room: 'bed3', at: [248, 116] },
    { id: 'alarm.primary', kind: 'smoke-alarm', room: 'primary', at: [83, 340] },
    { id: 'alarm.hall', kind: 'smoke-alarm', room: 'hall', at: [232, 177] },
  ],

  porch: {
    rect: [288, -72, 576, 0],
    posts: [
      [288.25, -71.5, 293.75, -66],
      [382.25, -71.5, 387.75, -66],
      [476.25, -71.5, 481.75, -66],
      [570.25, -71.5, 575.75, -66],
    ],
    steps: { rect: [312, -94, 360, -72], risers: 3 },
  },

  roof: {
    main: { type: 'gable', ridge: 'x', ridgeAt: 192, pitch: 6, eave: 12, rake: 12, framing: 'trusses', spacing: 24 },
    porch: { type: 'shed', pitch: 3, rect: [282, -84, 582, -12] },
  },

  dims: [
    { id: 'dim-n-1', axis: 'x', at: 432, lod: 1, refs: [{ wall: 'ext-w', face: 'lo' }, { wall: 'primary-e', face: 'c' }, { wall: 'wet', face: 'c' }, { wall: 'laundry-great', face: 'c' }, { wall: 'ext-e', face: 'hi' }] },
    { id: 'dim-n-2', axis: 'x', at: 468, lod: 1, refs: [{ wall: 'ext-w', face: 'lo' }, { wall: 'ext-e', face: 'hi' }] },
    { id: 'dim-w-1', axis: 'y', at: -48, lod: 1, refs: [{ wall: 'ext-s', face: 'lo' }, { wall: 'hall-s', face: 'c' }, { wall: 'hall-n', face: 'c' }, { wall: 'ext-n', face: 'hi' }] },
    { id: 'dim-w-2', axis: 'y', at: -84, lod: 1, refs: [{ wall: 'ext-s', face: 'lo' }, { wall: 'ext-n', face: 'hi' }] },
    { id: 'dim-int-1', axis: 'x', at: 24, lod: 2, refs: [{ wall: 'ext-w', face: 'lo' }, { wall: 'bed2-bed3', face: 'c' }, { wall: 'bed3-great', face: 'c' }] },
  ],

  annotations: { northArrow: [-56, -48], scaleBar: [0, -48] },
}
