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
 * The sign-off detail (owner: howcontact; timing/index.ts re-exports this
 * file, so it lives here). Plays once on entry, about 7.8 s in all:
 * - the drawing inks on: structure, connections, details (stagger × --i), then labels;
 * - a hold, then three records run the line at constant speed and are filed;
 * - the fourth reads out of range, goes down the branch and waits at the valve;
 * - the person turns the wheel, APPROVED lands, the record goes on and is filed.
 * Times in ms from the start. Packet runs move at 0.4 user units per ms, so the
 * tall family (a shorter line) has its own run lengths and log times.
 */
export const VALVE = {
  total: 7800,
  draw: 480,
  stagger: 80,
  p1: 2300,
  p2: 2900,
  p3: 3500,
  p4: 4400,
  run: 1690,
  runTall: 1420,
  divert: 3385,
  divertTall: 3485,
  needleAt: 2300,
  needleAtTall: 2070,
  needleDur: 5000,
  wheelAt: 6000,
  wheelDur: 500,
  approvedAt: 6600,
  log1: 3800,
  log2: 4400,
  log3: 5000,
  log4: 5760,
  log5: 7600,
  log1Tall: 3520,
  log2Tall: 4120,
  log3Tall: 4720,
  log4Tall: 5520,
  log5Tall: 7300,
} as const

/**
 * After you reach out (Contact, DETAIL 1 / G-03; owner: howcontact, kept here
 * beside VALVE since timing/index.ts re-exports this file). Plays once on
 * entry: the four enclosures ink on (stagger × --i), then their glyphs and
 * names, our two conduits, then the join from your node to ours with a SNAP.
 * A record then runs the route at constant speed, pausing in each node, and
 * the signature on the written next step inks in orange as it arrives.
 */
export const AFTER_CONTACT = {
  draw: 520,
  stagger: 100,
  snapAt: 1640,
  snap: 280,
  runAt: 1980,
  run: 3400,
  signAt: 5320,
  sign: 420,
} as const
