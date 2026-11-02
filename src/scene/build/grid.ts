import { Color, Mesh, PlaneGeometry, Vector2 } from 'three'
import type { Rect } from '@/lib/geom/rect'
import { PALETTE } from '@/lib/plan/pens'
import { GridMaterial } from '@/scene/materials/GridMaterial'

/** One large plane in plan space, its vertices in plan inches so the shader can read them directly. */
export function buildGrid(building: Rect): { mesh: Mesh; material: GridMaterial; center: Vector2 } {
  const center = new Vector2((building[0] + building[2]) / 2, (building[1] + building[3]) / 2)
  const geometry = new PlaneGeometry(4800, 4800)
  geometry.translate(center.x, center.y, 0)
  const material = new GridMaterial(new Color(PALETTE.gridMinor), new Color(PALETTE.rule), center)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'grid'
  mesh.renderOrder = -100
  mesh.frustumCulled = false
  return { mesh, material, center }
}
