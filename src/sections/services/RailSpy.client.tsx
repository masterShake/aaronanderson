'use client'
import { useEffect } from 'react'

/**
 * Scrollspy for the sticky sheet rail (1280 px and up): the sheet crossing 40%
 * of the viewport marks its rail link aria-current="true". Renders nothing.
 */
export function RailSpy({ rail }: { rail: string }) {
  useEffect(() => {
    const nav = document.getElementById(rail)
    if (!nav) return
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
    const sections = links
      .map((a) => document.getElementById(a.hash.slice(1)))
      .filter((el): el is HTMLElement => el !== null)
    const mark = (id: string) => {
      for (const a of links)
        if (a.hash === `#${id}`) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) mark(e.target.id)
      },
      { rootMargin: '-40% 0px -59% 0px' },
    )
    sections.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [rail])
  return null
}
