/**
 * The hero's one timing table (owner: hero lane), from the D2 storyboard. All
 * times are ms from the figure's start (first paint on desktop, the entry gate
 * on phones). packetSpeed (user units per second) is shared by the SVG plan
 * mechanism and the 3D scene; packetGap is the emission interval, so every
 * fourth packet (the held ticket) goes through the valve.
 */
export const HERO = {
  sketchStart: 120,
  toolDur: 360,
  toolGap: 70,
  lineStart: 600,
  lineDur: 300,
  lineGap: 45,
  peopleAt: 1000,
  personGap: 60,
  popDur: 160,
  notesAt: 1020,
  noteGap: 60,
  noteDur: 260,
  cloudsStart: 1320,
  cloudDur: 250,
  cloudGap: 60,
  scanStart: 1750,
  scanDur: 1200,
  liftDur: 150,
  decisionAt: 2950,
  runningAt: 3700,
  handoff: 120,
  tiltDur: 1600,
  loop: 6000,
  loops: 3,
  lateHandoffAt: 8950,
  idleAt: 20950,
  isoFade: 300,
  packetSpeed: 140,
  packetGap: 750,
  approveHold: 700,
} as const

/**
 * The hero's entry gate on phones (intersection ratio): it starts as its title strip comes into
 * view, so the sketch is already going on when the panel enters and no visitor sees an empty
 * panel (W4b: a blank frame is a failure). Other figures keep GATE.entry.
 */
export const HERO_ENTRY = 0.15
