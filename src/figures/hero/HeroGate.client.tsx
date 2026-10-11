'use client'

/**
 * The hero's entry gate before hydration (pages-drawings §4.5): an inline script right after
 * the figure arms it and, below 1024 px, marks it in view once it is at least 40% visible
 * (GATE.entry). The server renders it as text/javascript, the client as text/plain, so it
 * runs only on a full page load; on a soft navigation useFigure arms the figure instead.
 * If neither runs, motion.css releases it after GATE.cssAutoStart.
 */
export function HeroGate({ ratio, wide }: { ratio: number; wide: number }) {
  const js =
    `(function(){var f=document.getElementById('fig-hero'),h=document.documentElement;` +
    `if(!f||h.dataset.tier==='still')return;f.setAttribute('data-armed','');` +
    `try{if(matchMedia('(min-width:${wide}px)').matches){f.setAttribute('data-inview','');return}` +
    `var o=new IntersectionObserver(function(e){if(e[0].intersectionRatio>=${ratio}){f.setAttribute('data-inview','');o.disconnect()}},{threshold:[${ratio}]});o.observe(f)}` +
    `catch(x){f.setAttribute('data-inview','')}})()`
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: js }}
    />
  )
}
