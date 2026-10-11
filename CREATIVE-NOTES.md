# Creative notes

_Drafted by the copy lane in W1. The W3 final check filled in which WebGL scenes shipped._

## The idea

On a job site, the one-line diagram shows a whole electrical system on one sheet. This site
draws the same sheet for a firm's information.

- **As found:** a pencil sketch of a typical firm. Software is drawn as boxes, with
  hand-carry lines between them. Small pencil people stand on the lines, retyping. Doubts
  sit in the margins ("which one is current??").
- **Rewired:** a scan reads the sheet. The paper turns blueprint, the wobble becomes clean
  CAD, and the notes become specs. The people step off the wires to sign-off valves, next
  to estimating and out on site.
- **Running:** the plan tilts into an aluminum-and-orange model and runs. The people stay
  paper. When a valve turns, a person turned it.

The rest of the site is the same drawing at other scales: one connection per service sheet,
one delivery ticket on How it works, our org chart on About, and your company's node on
Contact.

## Where good design overrode the brief

- **Orange is never text on paper.** At 2.55:1 it fails contrast. Outside figures, orange
  means Book a call and nothing else; marks on paper use redline.
- **No green.** Gauges show a blue IN RANGE band, labeled in words. One less color, and no
  red/green confusion.
- **AI is an instrument, not a robot.** It is a bubble on the line marked AI READER that
  reads and never signs. S-03 is a section through a reading machine, not a robot arm.
- **3D only where depth or light explains something.** The hero, S-02 and S-03, with S-04
  and S-06 optional; never all six services. Every 3D scene has an SVG print that can ship
  alone.
- **Plain words before symbols.** "Sign-off valve (HV)", "Monitor (MON)". A superintendent
  or an HR lead should follow every drawing without opening the legend.
- **Honest by construction.** Company drawings carry "EXAMPLE FIRM — NOT A CLIENT", demo
  data says SAMPLE, and every count in the copy comes from the drawing data. Facts we don't
  have are HOLDs; promises the owner hasn't agreed to are CONFIRMs, hidden in production.
- **Short pages.** The brief's two-sentence explanations stay two short sentences. One
  sub-head per section, bullets over paragraphs, no reply-time or guarantee filler.
- **No smooth-scroll library, no dark mode, no scroll-jacking.** Native scrolling stays
  native, and the blueprint panels and asphalt bands already give the site its darks.
- **The hero runs, then rests.** Three loops, then it holds the finished still with a Run
  again button. A drawing that loops forever stops being read.

## Why vanilla three.js instead of React Three Fiber

- **Less JavaScript on the main thread.** One small stage with one canvas, moved into
  whichever figure is most visible, costs less than a React reconciler for a scene graph
  that changes a few times per page.
- **The drawing comes first.** Every figure is an SVG drawing that works before any script
  runs. 3D is an enhancement that takes over at a still, orthographic frame, so the hand-off
  is invisible. A plain Stage API (register, set progress, play, release) fits that better
  than a component tree.
- **Fewer dependencies to pin.** R3F and drei would add versions that move with React;
  three 0.186.1 alone is pinned and budgeted.

## The WebGL quality gate

Every WebGL scene must earn its place. A scene ships as WebGL only if:

- the seam between the SVG plan and the first 3D frame is invisible at 1440 and 1280;
- the frame guard never trips in a minute of running, with median frames at 17.5 ms or less;
- context loss falls back to the SVG print within half a second;
- its chunk stays inside the 3D budget;
- a review of the craft screenshots agrees it explains more than the print does.

Otherwise its SVG print ships instead. Nothing looks missing either way.

## Which WebGL scenes shipped

Scenes shipped as WebGL: the hero, S-02 and S-06. S-03 and S-04 ship their SVG prints.
Recorded by the W3 final check (2026-10-11) on the Mac's GPU (`--use-angle=metal`).

| Scene | Shipped as                      | Why                                                                                                                                                                                                     |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero  | WebGL on desktop; SVG on touch  | Every gate passed: seam at 1440@2 and 1280@1, 60 s with the guard untripped (median frame 16.7 ms), context loss and leaks, chunk 5.8 KB, Cost 145 ms TBT. On touch it stays the SVG print (see below). |
| S-02  | WebGL (desktop, 1024 px and up) | Every gate passed: seam, frames, context loss, leaks, chunk 4.5 KB, Cost 118 ms TBT. It now hands off during a steady scroll too.                                                                       |
| S-03  | SVG print                       | Failed the tolerant seam limit at 1280@1 and 1440@2 in W2 and again in W3. The section cut reads fully as a print.                                                                                      |
| S-04  | SVG print                       | Failed the seam at 1280@1 in W2 and again in W3. The dials and chips work the same in the print.                                                                                                        |
| S-06  | WebGL (desktop, 1024 px and up) | Every gate passed, including the services scrub hand-off: seam, frames, context loss, leaks, chunk 5.1 KB, Cost 130 ms TBT.                                                                             |

- **/services 3D total:** 172.4 KB gzip with S-02 and S-06 (limit 180). All four service
  scenes together would be 182.5 KB, so at most three could ship as the runtime stands.
- **Cost gate:** `npm run perf:lh -- --webgl-gate --method devtools --runs 5` (desktop preset,
  4× CPU, hardware renderer, the run must fetch the 3D runtime). At 7× CPU the desktop page
  already measures 367 ms TBT with no 3D at all, so those numbers are recorded as advisory.
- **Hero on phones (`HERO_TOUCH_3D = 'deferred'`):** the 3D build adds 119 ms of TBT to `/`
  (145 ms on `?tier=webgl` against 26 ms on `?tier=svg`, same preset), past D9's 50 ms line.
  A phone's CPU is slower than the desktop measured, so phones keep the SVG drawing, which
  plays the same story.
