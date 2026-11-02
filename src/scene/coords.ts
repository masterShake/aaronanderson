/**
 * Plan space → world space. The house is built in plan inches (Z up) under `houseRoot`, which
 * is rotated −π/2 about X and never scaled: plan (x, y, z) becomes world (x, z, −y), so one
 * world unit is one inch and +Y is up. Only the camera works in world coordinates.
 */
import { Group, Vector3 } from 'three'

export function createHouseRoot(): Group {
  const g = new Group()
  g.name = 'houseRoot'
  g.rotation.x = -Math.PI / 2
  return g
}

export const planToWorld = (x: number, y: number, z = 0, out = new Vector3()): Vector3 => out.set(x, z, -y)
