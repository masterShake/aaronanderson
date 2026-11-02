/**
 * frameHouse(house): the whole wood frame as oriented boxes in plan inches, derived from the
 * resolved HouseSpec. Members come in beat order (plates, floor, foundation, deck, exterior walls
 * by raise batch, interior walls, caps, trusses west to east, rake ladders, porch), and every
 * member belongs to exactly one assembly. Deterministic, so the scene stays a pure function of
 * scroll.
 */
import { frameFloor, sideOf } from '@/lib/framing/floor'
import { boundsOf } from '@/lib/framing/geom3'
import { assertPorchFramable, framePorch, porchLines } from '@/lib/framing/porch'
import { frameRoof, roofLines } from '@/lib/framing/roof'
import {
  frameDatums,
  GIRDER,
  GRADE_CLEARANCE,
  LONG_STOCK,
  PLATE_STOCK,
  STEM_ABOVE_GRADE,
  stockLength,
  type FrameDatums,
} from '@/lib/framing/spec'
import type { Assembly, Frame, Member, Motion, Tilt } from '@/lib/framing/types'
import { assertWallsFramable, frameWalls } from '@/lib/framing/walls'
import type { ResolvedHouse } from '@/lib/house/resolve'

/** Shapes this round can frame. Throws with a reason for anything else. */
export function assertFramable(house: ResolvedHouse): void {
  const { spec } = house
  const fp = spec.footprint
  const z = frameDatums(spec)
  const ext = house.walls.filter((w) => w.spec.kind === 'exterior')
  if (ext.length !== 4)
    throw new Error('Framing needs a rectangular footprint with four exterior walls')
  if (new Set(ext.map((w) => sideOf(w, house))).size !== 4)
    throw new Error('One exterior wall per side')
  if (new Set(ext.map((w) => w.asm.depth)).size !== 1)
    throw new Error('Exterior walls must share one stud depth')
  const main = spec.roof.main
  if (main.type !== 'gable' || main.ridge !== 'x' || main.framing !== 'trusses')
    throw new Error('Only a trussed gable with the ridge along x is framed')
  if (main.ridgeAt !== (fp[1] + fp[3]) / 2)
    throw new Error('The ridge must sit over the middle of the span')
  const studs = z.studTop - z.bottomPlateTop
  if (studs <= 0 || studs > PLATE_STOCK) throw new Error(`Stud length ${studs}″ is out of range`)
  if (z.stemTop - z.grade < STEM_ABOVE_GRADE)
    throw new Error('The stem wall must stand 6″ above grade (R404.1.6)')
  if (z.joistBottom - z.grade < GRADE_CLEARANCE.joist)
    throw new Error(
      'Joists sit within 18″ of grade (R317.1): raise the floor or use treated lumber',
    )
  if (2 * GIRDER.pierSpacing > LONG_STOCK) throw new Error('Girder plies would exceed stock length')
  assertWallsFramable(house, z)
  const roof = roofLines(house, z)
  const chord = (roof.ridgeAt - roof.tail0) / roof.cos
  if (chord > LONG_STOCK) throw new Error(`Top chords of ${chord.toFixed(1)}″ exceed 20′ stock`)
  assertPorchFramable(house, z, roof)
}

export function frameHouse(house: ResolvedHouse): Frame {
  assertFramable(house)
  const z = frameDatums(house.spec)
  const floor = frameFloor(house, z)
  const walls = frameWalls(house, z)
  const roof = frameRoof(house, z)
  const porch = framePorch(house, z)

  // Exterior walls by raise batch; far walls first within a batch (N before S, W before E).
  const ext = walls
    .filter((w) => w.tilt)
    .sort(
      (a, b) => a.tilt!.batch - b.tilt!.batch || farFirst(a.wall.spec.id, b.wall.spec.id, house),
    )
  const int = walls.filter((w) => !w.tilt)
  const plates = walls.flatMap((w) => w.plates)
  const caps = walls.flatMap((w) => w.caps)

  const members: Member[] = []
  const assemblies: Assembly[] = []
  const push = (id: string, motion: Motion, list: readonly Member[], tilt?: Tilt) => {
    const start = members.length
    for (const m of list) {
      if (m.group !== id) throw new Error(`${m.id} is in ${m.group}, listed under ${id}`)
      members.push(m)
    }
    assemblies.push({
      id,
      motion,
      members: list.map((_, i) => start + i),
      ...(tilt ? { tilt } : {}),
    })
  }
  push('plates', 'pieces', plates)
  push('floor', 'pieces', floor.floor)
  push('foundation', 'pieces', floor.foundation)
  push('deck', 'pieces', floor.deck)
  for (const w of ext) push(`wall/${w.wall.spec.id}`, 'tilt', w.frame, w.tilt)
  for (const w of int) push(`wall/${w.wall.spec.id}`, 'pieces', w.frame)
  push('caps', 'pieces', caps)
  for (const t of roof.trusses) push(t.id, 'unit', t.members)
  for (const r of roof.rakes) push(r.id, 'unit', r.members)
  if (porch.length) push('porch', 'pieces', porch)

  for (const m of members)
    if (m.size[0] > stockLength(m) + 1e-9) throw new Error(`${m.id} is longer than its stock`)

  return { members, assemblies, datums: datumsOf(house, z), bounds: boundsOf(members) }
}

function farFirst(a: string, b: string, house: ResolvedHouse): number {
  const rank = (id: string) => ['n', 's', 'w', 'e'].indexOf(sideOf(house.wall(id), house))
  return rank(a) - rank(b)
}

/** Elevations, plus heelHeight: bottom of the bottom chord to top of the top chord at the wall line. */
function datumsOf(house: ResolvedHouse, z: FrameDatums): Record<string, number> {
  const roof = roofLines(house, z)
  const porch = porchLines(house)
  return {
    ...z,
    pierTop: z.joistBottom,
    heelHeight: roof.heelHeight,
    heel: z.plate + roof.heelHeight,
    ridge: roof.ridge,
    tail: roof.lowerEdge(roof.tail0), // underside of the truss tails at the fascia line
    ...(porch ? { porchBeam: porch.beamTop, porchLedger: porch.ledger.z[1] } : {}),
  }
}
