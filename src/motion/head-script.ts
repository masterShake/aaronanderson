/**
 * The inline <head> script: the only writer of the page-state attributes on
 * <html> and of the saved motion choice. It runs before first paint, so a
 * paused visitor never sees anything move, and the motion switch works before
 * React hydrates.
 *
 * Attributes it writes (Appendix B §B4):
 *   data-js           '1' once this script has run
 *   data-rm           '1' when the OS asks for reduced motion
 *   data-motion       'run' | 'paused'
 *   data-tier         'still' | 'svg' (the Stage may later promote svg to webgl)
 *   data-tier-force   the ?tier= value, when present
 *   data-tier-max     'svg' | 'webgl'
 * Storage: localStorage 'ae:motion', sessionStorage 'ae:tier' (read only; the Stage's downgrade writes it).
 * Event: 'ae:state' on document whenever the state changes.
 * Global: window.__ae.{apply, setPaused, sync}.
 *
 * Decided: a saved 'run' overrides the OS reduced-motion setting, but the tier
 * stays svg (data-tier-max 'svg'), so there is never 3D under reduced motion.
 */

export const STATE_EVENT = 'ae:state'
export const MOTION_KEY = 'ae:motion'
export const TIER_KEY = 'ae:tier'
export const SWITCH_SELECTOR = 'input[data-motion-switch]'

export interface AeGlobal {
  /** Recompute every attribute from storage, the query and the OS setting. */
  apply(): void
  /** Pause or run motion site-wide, remember it, and notify. */
  setPaused(paused: boolean): void
  /** Tick every motion switch to match; re-apply if the attributes went missing. */
  sync(): void
}

declare global {
  interface Window {
    __ae?: AeGlobal
  }
}

export const HEAD_SCRIPT = `(function(){var d=document,h=d.documentElement,ls,ss;try{ls=localStorage;ss=sessionStorage}catch(e){}
function g(s,k){try{return s&&s.getItem(k)}catch(e){return null}}
function apply(){var rm=matchMedia('(prefers-reduced-motion: reduce)').matches,saved=g(ls,'${MOTION_KEY}'),
q=/[?&]tier=(still|svg|webgl)\\b/.exec(location.search),force=q&&q[1],paused=saved?saved==='paused':rm,
tier=force||(paused?'still':'svg');h.dataset.js='1';h.dataset.rm=rm?'1':'0';h.dataset.motion=paused?'paused':'run';
h.dataset.tier=tier;if(force)h.dataset.tierForce=force;else delete h.dataset.tierForce;
h.dataset.tierMax=force||(rm||g(ss,'${TIER_KEY}')==='svg'?'svg':'webgl');check()}
function check(){var p=h.dataset.motion==='paused',s=d.querySelectorAll('${SWITCH_SELECTOR}');for(var i=0;i<s.length;i++)s[i].checked=p}
function sync(){if(!h.dataset.motion||!h.dataset.tier){apply();d.dispatchEvent(new CustomEvent('${STATE_EVENT}'))}else check()}
function set(p){h.dataset.motion=p?'paused':'run';try{ls.setItem('${MOTION_KEY}',p?'paused':'run')}catch(e){}check();d.dispatchEvent(new CustomEvent('${STATE_EVENT}'))}
d.addEventListener('change',function(e){var t=e.target;if(t&&t.matches&&t.matches('${SWITCH_SELECTOR}'))set(t.checked)});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',function(){apply();d.dispatchEvent(new CustomEvent('${STATE_EVENT}'))});
d.addEventListener('DOMContentLoaded',check);window.__ae={apply:apply,setPaused:set,sync:sync};apply()})()`
