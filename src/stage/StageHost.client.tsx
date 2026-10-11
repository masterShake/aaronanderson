'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { host } from './host'
import { installDebug } from './debug'

/**
 * Where the Stage parks its one canvas between figures, plus the page-level
 * hooks: each route's stage figures are probed and prefetched on their own
 * LoadPolicy (D9: desktop after load then idle; touch after load once the
 * figure is 30% visible; services when a figure is within one viewport), the
 * loop sleeps while the page is in the back/forward cache, and the debug
 * surface is installed outside production.
 */
export function StageHost() {
  const pathname = usePathname()

  useEffect(() => {
    installDebug()
    const hide = () => host().rt?.suspend(true)
    const show = () => host().rt?.suspend(false)
    addEventListener('pagehide', hide)
    addEventListener('pageshow', show)
    return () => {
      removeEventListener('pagehide', hide)
      removeEventListener('pageshow', show)
    }
  }, [])

  useEffect(() => {
    // After the new route's figures are in the DOM.
    const id = requestAnimationFrame(() => host().scan())
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return <div id="stage-park" hidden />
}
