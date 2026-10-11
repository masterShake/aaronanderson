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
