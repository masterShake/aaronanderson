'use client'
import { useEffect } from 'react'

/**
 * Applies ?state= to the figure on the /kit/fig harness: presses the matching
 * state button when the figure has one (the schematic's toggle), otherwise
 * writes data-rev and data-toggle directly. Preview only.
 */
export function KitState({ figure }: { figure: string }) {
  useEffect(() => {
    const state = new URLSearchParams(location.search).get('state')
    const fig = document.getElementById(figure)
    if (!state || !fig) return
    const btn = fig.querySelector<HTMLButtonElement>(`[data-state-value="${CSS.escape(state)}"]`)
    if (btn) btn.click()
    else {
      fig.dataset.rev = state
      fig.dataset.toggle = state
    }
  }, [figure])
  return null
}
