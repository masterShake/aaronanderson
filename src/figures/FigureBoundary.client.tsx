'use client'
import { Component, type ReactNode } from 'react'
import { downgrade } from '@/stage/tier'

/**
 * Wraps every figure controller and stage slot. If one throws, the figure
 * shows its still, data-phase becomes still, and 3D is off for the session.
 * W0 minimal; owner: stage lane.
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
    if (fig) fig.dataset.phase = 'still'
    downgrade('build-error')
  }

  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
