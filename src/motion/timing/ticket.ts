/**
 * Ticket figure timing (owner: how). Steps P-01 to P-05 switch revisions as
 * their sections cross GATE.stepLine; these are the transitions between
 * revisions (pages-drawings §6.7). Durations in ms.
 */
export const TICKET = {
  /** Groups and labels fade between revisions. */
  revSwitch: 600,
  /** REV 1: the tracing paper slides in. */
  tracing: 600,
  /** REV 2: the test packets run the line once. */
  packets: 2400,
  /** REV 3: the old route is erased; the documents fan out; the punch list ticks. */
  erase: 240,
  fan: 300,
  tick: 200,
  /** REV 4: the flange pulses twice (at most two flashes a second). */
  pulse: 500,
} as const

/**
 * The sign-off detail (owner: how; timing/index.ts re-exports this file, so it
 * lives here). Plays once on entry, 4600 ms in all (pages-drawings §6.8): three
 * packets pass inside tolerance, the fourth falls below the mark, is diverted
 * to the valve, approved by a person and rejoins. Times in ms from the start.
 */
export const VALVE = {
  total: 4600,
  run: 900,
  p1: 0,
  p2: 700,
  p3: 1400,
  p4: 2300,
  p4Run: 2300,
  needleAt: 2600,
  needleDur: 300,
  flapAt: 2700,
  flapDur: 1400,
  wheelAt: 3500,
  wheelDur: 300,
  approvedAt: 3800,
  log1: 900,
  log2: 1600,
  log3: 2300,
  log4: 3000,
  log5: 4400,
} as const
