'use client'
import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * After every route change, ticks any newly mounted motion switch to match the
 * saved state (and restores the <html> attributes if StrictMode's dev remount
 * cleared them). Calls sync(), never apply(): apply() would demote a live
 * webgl tier back to svg.
 */
export function HtmlStateSync() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    window.__ae?.sync()
  }, [pathname])
  return null
}
