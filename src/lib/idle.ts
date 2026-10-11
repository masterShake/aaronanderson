/**
 * When the page's scenes do their building: a little at a time, in moments
 * the page has to spare, so frames, taps and scrolling always come first. No
 * three.js here, so the page's own code can ask for these without loading it.
 *
 * Those moments are the browser's idle callbacks where it has them. Safari
 * (iOS too) has none, and the plain timer that stood in for them gave the
 * builds a few milliseconds every 40 — a scene with a third of a second of
 * work took several seconds over it, and the page's six took fifteen. Where
 * they are missing, the work runs after each frame instead: one
 * requestAnimationFrame while anything waits, then each waiting callback in a
 * task of its own (a message posted to the page) with what is left of the
 * frame as its deadline — until `BUDGET_MS` from the frame's start is spent,
 * when the rest wait for the next frame. A callback queued in that window runs
 * in it if there is time. A timeout still fires, as the browser's own does,
 * should frames stop (a hidden tab draws none). Off the page (Node, where the
 * builds are dry-run) it is a timer, as before.
 *
 * Ported from the owner's mikegianni/client/src/lib/idle.js.
 */

/** What an idle callback is handed: how long it may run, and whether it came late. */
export interface IdleDeadlineLike {
  readonly didTimeout: boolean
  timeRemaining(): number
}

type IdleFn = (deadline: IdleDeadlineLike) => void

const NATIVE = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
const FRAMES = typeof requestAnimationFrame === 'function' && typeof MessageChannel === 'function'

/** How this page gets its idle moments, for the `?perf` readout. */
export const idleKind: 'native' | 'frame-aware' | 'timer' = NATIVE
  ? 'native'
  : FRAMES
    ? 'frame-aware'
    : 'timer'

/**
 * How much of each frame the waiting work may have, ms from when the frame's
 * work began: about half a 60 Hz frame (12 ms dropped a few more frames on a
 * slow phone for little gain), and never more than half the frame, so a
 * 120 Hz display keeps its frames whole.
 */
const BUDGET_MS = 8

interface Job {
  fn: IdleFn
  timer: ReturnType<typeof setTimeout> | 0
}

/** What waits for a frame, first come first served. */
const queue: Job[] = []
let channel: MessageChannel | null = null
/** Messages posted and not yet run. */
let posted = 0
let asked = false
let frameAt = -Infinity
let lastFrame = 0
let frameMs = 1000 / 60
const left = () => Math.max(0, frameAt + Math.min(BUDGET_MS, frameMs / 2) - performance.now())
const deadline: IdleDeadlineLike = { didTimeout: false, timeRemaining: left }
const late: IdleDeadlineLike = { didTimeout: true, timeRemaining: () => 0 }

function ask() {
  if (asked) return
  asked = true
  requestAnimationFrame(frame)
}

function frame(t: number) {
  asked = false
  // Frames back to back say how long one is (120 Hz at the shortest); after a
  // pause, the last measure stands.
  if (t - lastFrame < 40) frameMs = Math.max(8, t - lastFrame)
  lastFrame = t
  frameAt = performance.now()
  pump()
}

/** One message in flight for each waiting callback, no more. */
function pump() {
  if (!channel) {
    channel = new MessageChannel()
    channel.port1.onmessage = runOne
  }
  for (; posted < queue.length; posted++) channel.port2.postMessage(0)
}

function runOne() {
  posted--
  const job = queue[0]
  if (!job) return
  if (left() <= 0) {
    ask()
    return
  }
  queue.shift()
  clearTimeout(job.timer)
  job.fn(deadline)
}

/** `fn(deadline)` after a frame, or `fn(late)` after `timeoutMs` whatever happens. */
function afterFrame(fn: IdleFn, timeoutMs: number): () => void {
  const job: Job = { fn, timer: 0 }
  job.timer = setTimeout(() => {
    const i = queue.indexOf(job)
    if (i < 0) return
    queue.splice(i, 1)
    fn(late)
  }, timeoutMs)
  queue.push(job)
  ask()
  // Queued while a frame's time is being handed out: it may have what is left.
  if (left() > 0) pump()
  return () => {
    const i = queue.indexOf(job)
    if (i >= 0) queue.splice(i, 1)
    clearTimeout(job.timer)
  }
}

/** Run `fn` when the browser next has nothing better to do, or soon after regardless. */
export function whenIdle(fn: IdleFn): void {
  if (NATIVE) window.requestIdleCallback(fn, { timeout: 500 })
  else if (FRAMES) afterFrame(fn, 500)
  else setTimeout(() => fn(late), 40)
}

/**
 * Start `fn` in the page's next idle moment, or after `timeoutMs` at the
 * latest — a scene's start, once the one before it is up.
 * @returns a function that calls the start off
 */
export function idleStart(fn: IdleFn, timeoutMs: number): () => void {
  if (NATIVE) {
    const id = window.requestIdleCallback(fn, { timeout: timeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  if (FRAMES) return afterFrame(fn, timeoutMs)
  const id = setTimeout(() => fn(late), 40)
  return () => clearTimeout(id)
}

/** What `soon` has yet to run, first come first served, and the channel it posts on (made on first use). */
const pending: (() => void)[] = []
let soonChannel: MessageChannel | null = null

/**
 * Run `fn` in a task of its own straight after this one: a message posted to
 * the page itself. A frame, a tap or anything else the page has waiting
 * still comes in between, but nothing waits on an idle moment or a frame —
 * the first thing seen is made this way. One message a call, and one call a
 * message.
 */
export function soon(fn: () => void): void {
  if (!soonChannel) {
    soonChannel = new MessageChannel()
    soonChannel.port1.onmessage = () => pending.shift()?.()
  }
  pending.push(fn)
  soonChannel.port2.postMessage(0)
}
