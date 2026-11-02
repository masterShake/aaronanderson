/**
 * ?debug: a small HUD (story time, chapter progress, fps, draw calls) and window.__AE__ for the
 * console and screenshot scripts. Loaded only when the flag is present.
 */
import { Vector3, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three'
import type { StoryStore } from '@/client/story'
import type { Timeline } from '@/lib/draft/timeline'
import type { Frame, Vec3 } from '@/lib/framing/types'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { PlanDrawing } from '@/lib/plan/types'
import { CHAPTERS } from '@/lib/story/chapters'
import type { Layout } from '@/scene/camera'
import type { ChapterStage } from '@/scene/chapters/types'

export interface DebugTargets {
  host: HTMLElement
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  plan: PlanDrawing
  timeline: Timeline
  house: ResolvedHouse
  frame: Frame
  chapters: readonly ChapterStage[]
  layout(): Layout
  story: StoryStore
  frames(): number
}

declare global {
  interface Window {
    __AE__?: DebugTargets & {
      info(): { calls: number; triangles: number; programs: number; geometries: number; textures: number }
      samplePixels(points: [number, number][]): number[][]
      project(q: Vec3): [x: number, y: number, depth: number]
    }
  }
}

export function attachDebug(t: DebugTargets): void {
  const hud = document.createElement('pre')
  hud.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:50;margin:0;padding:6px 8px;background:#fff;border:1px solid #1d1d1f;font:11px/1.35 ui-monospace,monospace;pointer-events:none;color:#1d1d1f'
  document.body.appendChild(hud)
  let lastFrames = t.frames()
  let lastT = performance.now()
  let fps = 0
  const tick = () => {
    const now = performance.now()
    if (now - lastT > 500) {
      fps = ((t.frames() - lastFrames) * 1000) / (now - lastT)
      lastFrames = t.frames()
      lastT = now
    }
    const s = t.story.s
    const i = Math.min(CHAPTERS.length - 1, Math.floor(s))
    const info = t.renderer.info
    hud.textContent = [
      `s ${s.toFixed(4)}  ${CHAPTERS[i].id} p ${(s - i).toFixed(4)}`,
      `state ${t.host.dataset.stageState}  fps ${fps.toFixed(0)}  frames ${t.frames()}`,
      `calls ${info.render.calls}  tris ${info.render.triangles}  programs ${info.programs?.length ?? 0}`,
      `dpr ${t.renderer.getPixelRatio().toFixed(2)}  canvas ${t.renderer.domElement.width}×${t.renderer.domElement.height}`,
    ].join('\n')
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  window.__AE__ = {
    ...t,
    info() {
      const i = t.renderer.info
      return {
        calls: i.render.calls,
        triangles: i.render.triangles,
        programs: i.programs?.length ?? 0,
        geometries: i.memory.geometries,
        textures: i.memory.textures,
      }
    },
    /** Read back pixels (device px, top-left origin) right after a render. */
    samplePixels(points) {
      t.renderer.render(t.scene, t.camera)
      const gl = t.renderer.getContext()
      const h = t.renderer.domElement.height
      return points.map(([x, y]) => {
        const px = new Uint8Array(4)
        gl.readPixels(x, h - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        return Array.from(px)
      })
    },
    /** A plan point through the current camera: CSS px from the canvas's top-left, and depth in inches. */
    project(q) {
      const { W, H } = t.layout()
      const v = new Vector3(q[0], q[2], -q[1]).applyMatrix4(t.camera.matrixWorldInverse)
      const depth = -v.z
      v.applyMatrix4(t.camera.projectionMatrix)
      return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H, depth]
    },
  }
}
