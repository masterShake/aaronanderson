'use client'
import { Component, type ReactNode } from 'react'

/**
 * Wraps every figure controller and stage slot. If one throws, that figure
 * alone shows its still and data-phase becomes still. It never downgrades the
 * session (W0 addendum 2): only context loss and the frame guard take 3D away
 * from the other scenes.
 */
export class FigureBoundary extends Component<
  { figureId: string; fallback?: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    const fig = document.getElementById(`fig-${this.props.figureId}`)
    if (!fig) return
    fig.dataset.phase = 'still'
    fig.dataset.medium = 'svg'
    fig.dataset.stage = 'svg'
  }

  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
