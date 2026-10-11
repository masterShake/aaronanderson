'use client'
import { useEffect, useState } from 'react'

/**
 * Loads the bundle probe when the URL has ?probe=1, and marks
 * html[data-probe="loaded"] so the W0 measurement knows the chunk arrived.
 * Reads location on the client, so the page stays static.
 */
export function ProbeLoader({ loaded }: { loaded: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!/[?&]probe=1\b/.test(location.search)) return
    let live = true
    import('@/scenes/_probe').then((m) => {
      if (!live) return
      document.documentElement.dataset.probe = 'loaded'
      document.documentElement.dataset.probeClasses = String(m.PROBE_CLASSES.length)
      setDone(true)
    })
    return () => {
      live = false
    }
  }, [])
  return <p aria-live="polite">{done ? loaded : null}</p>
}
